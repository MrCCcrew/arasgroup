import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ orderId: string }> }

const schema = z.object({
  allocations: z.array(z.object({
    driverId: z.string().min(1),
    allocatedOrders: z.number().int().min(0),
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
      select: { id: true, companyId: true, ordersCount: true },
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

    await prisma.$transaction(async (tx) => {
      await tx.deliveryDailyOrderAllocation.deleteMany({ where: { dailyOrderId: orderId } });
      if (lines.length > 0) {
        await tx.deliveryDailyOrderAllocation.createMany({
          data: lines.map((l) => ({
            dailyOrderId: orderId,
            driverId: l.driverId,
            allocatedOrders: l.allocatedOrders,
            notes: l.notes ?? null,
            createdById: session.id,
          })),
        });
      }
    });

    return NextResponse.json({ success: true, allocated: lines.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في توزيع الطلبات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
