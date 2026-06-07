import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ orderId: string }> }

const schema = z.object({
  allocations: z.array(z.object({
    driverId: z.string().min(1),
    allocatedOrders: z.number().int().min(0),
    walletAmount: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).default([]),
});

/**
 * توزيع طلبات سجل يومي على السائق الفعلي (عند العمل بحساب سائق آخر).
 * السجل الأصلي لا يُمسّ؛ تُستبدل طبقة التوزيع فقط. مجموع الموزّع يجب أن يساوي
 * عدد طلبات السجل. تمرير مصفوفة فارغة يلغي التوزيع ويعيد النسبة للسائق الأصلي.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { orderId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const order = await prisma.deliveryDailyOrder.findUnique({
      where: { id: orderId },
      select: { id: true, companyId: true, ordersCount: true, driverId: true, date: true },
    });
    if (!order) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, order.companyId);
    if (companyAccessError) return companyAccessError;

    // نتجاهل السطور الصفرية، ونمنع تكرار السائق
    const lines = parsed.data.allocations.filter((a) => a.allocatedOrders > 0);
    const driverIds = lines.map((l) => l.driverId);
    if (new Set(driverIds).size !== driverIds.length) {
      return NextResponse.json({ success: false, error: "لا يمكن تكرار نفس السائق في التوزيع" }, { status: 400 });
    }

    if (lines.length > 0) {
      const totalAllocated = lines.reduce((s, l) => s + l.allocatedOrders, 0);
      if (totalAllocated !== order.ordersCount) {
        return NextResponse.json({
          success: false,
          error: `إجمالي الموزّع (${totalAllocated}) يجب أن يساوي عدد طلبات السجل (${order.ordersCount})`,
        }, { status: 400 });
      }

      // نتأكد أن السائقين يتبعون نفس الشركة
      const validDrivers = await prisma.driver.count({
        where: { id: { in: driverIds }, employee: { companyId: order.companyId } },
      });
      if (validDrivers !== driverIds.length) {
        return NextResponse.json({ success: false, error: "أحد السائقين غير صالح لهذه الشركة" }, { status: 400 });
      }
    }

    const dateStr = order.date.toISOString().slice(0, 10);

    await prisma.$transaction(async (tx) => {
      // 1) عكس أثر التوزيع السابق على أرصدة المحافظ (idempotent):
      //    نُعيد ما نُقل من الأصلي إلى البدلاء.
      const prior = await tx.deliveryDailyOrderAllocation.findMany({
        where: { dailyOrderId: orderId },
        select: { driverId: true, walletAmount: true },
      });
      for (const p of prior) {
        const w = Number(p.walletAmount ?? 0);
        if (w > 0 && p.driverId !== order.driverId) {
          await tx.driver.update({ where: { id: order.driverId }, data: { walletBalance: { increment: w } } });
          await tx.driver.update({ where: { id: p.driverId }, data: { walletBalance: { decrement: w } } });
        }
      }
      // 2) نحذف حركات المحفظة الناتجة عن التوزيع السابق لهذا السجل، وكذلك التوزيعات
      await tx.driverWalletTransaction.deleteMany({ where: { dailyOrderId: orderId } });
      await tx.deliveryDailyOrderAllocation.deleteMany({ where: { dailyOrderId: orderId } });

      // 3) ننشئ التوزيع الجديد ونطبّق نقل المحفظة للبدلاء بحركات موثّقة
      for (const l of lines) {
        await tx.deliveryDailyOrderAllocation.create({
          data: {
            dailyOrderId: orderId,
            driverId: l.driverId,
            allocatedOrders: l.allocatedOrders,
            walletAmount: l.walletAmount && l.walletAmount > 0 ? l.walletAmount : null,
            notes: l.notes ?? null,
            createdById: session.id,
          },
        });

        const w = l.walletAmount ?? 0;
        if (w > 0 && l.driverId !== order.driverId) {
          // ننقل التحصيل من رصيد السائق الأصلي إلى السائق البديل
          await tx.driver.update({ where: { id: order.driverId }, data: { walletBalance: { decrement: w } } });
          await tx.driver.update({ where: { id: l.driverId }, data: { walletBalance: { increment: w } } });
          // حركة موثّقة على الطرفين
          await tx.driverWalletTransaction.create({
            data: {
              driverId: order.driverId, type: "SETTLEMENT", amount: w, date: order.date,
              dailyOrderId: orderId, descriptionAr: `نقل تحصيل إلى سائق بديل (توزيع طلبات ${dateStr})`,
            },
          });
          await tx.driverWalletTransaction.create({
            data: {
              driverId: l.driverId, type: "CHARGE", amount: w, date: order.date,
              dailyOrderId: orderId, descriptionAr: `تحصيل موزّع من حساب السائق الأصلي (${dateStr})`,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, allocated: lines.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في توزيع الطلبات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
