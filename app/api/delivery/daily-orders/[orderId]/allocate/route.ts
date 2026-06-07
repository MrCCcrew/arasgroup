import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { recomputeDriverWalletStates } from "@/lib/delivery/wallet-state";

interface Ctx {
  params: Promise<{ orderId: string }>;
}

const schema = z.object({
  allocations: z.array(
    z.object({
      driverId: z.string().min(1),
      allocatedOrders: z.number().int().min(0),
      walletAmount: z.number().min(0).optional(),
      notes: z.string().optional(),
    }),
  ).default([]),
});

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
    if (!order) {
      return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, order.companyId);
    if (companyAccessError) return companyAccessError;

    const lines = parsed.data.allocations.filter((allocation) => allocation.allocatedOrders > 0);
    const driverIds = lines.map((line) => line.driverId);
    if (new Set(driverIds).size !== driverIds.length) {
      return NextResponse.json({ success: false, error: "لا يمكن تكرار نفس السائق في التوزيع" }, { status: 400 });
    }

    if (lines.length > 0) {
      const totalAllocated = lines.reduce((sum, line) => sum + line.allocatedOrders, 0);
      if (totalAllocated !== order.ordersCount) {
        return NextResponse.json(
          {
            success: false,
            error: `إجمالي الموزع (${totalAllocated}) يجب أن يساوي عدد طلبات السجل (${order.ordersCount})`,
          },
          { status: 400 },
        );
      }

      const validDrivers = await prisma.driver.count({
        where: { id: { in: driverIds }, employee: { companyId: order.companyId } },
      });
      if (validDrivers !== driverIds.length) {
        return NextResponse.json({ success: false, error: "أحد السائقين غير صالح لهذه الشركة" }, { status: 400 });
      }
    }

    const dateStr = order.date.toISOString().slice(0, 10);

    await prisma.$transaction(async (tx) => {
      const priorAllocations = await tx.deliveryDailyOrderAllocation.findMany({
        where: { dailyOrderId: orderId },
        select: { driverId: true },
      });

      await tx.driverWalletTransaction.deleteMany({ where: { dailyOrderId: orderId } });
      await tx.deliveryDailyOrderAllocation.deleteMany({ where: { dailyOrderId: orderId } });

      for (const line of lines) {
        await tx.deliveryDailyOrderAllocation.create({
          data: {
            dailyOrderId: orderId,
            driverId: line.driverId,
            allocatedOrders: line.allocatedOrders,
            walletAmount: line.walletAmount && line.walletAmount > 0 ? line.walletAmount : null,
            notes: line.notes ?? null,
            createdById: session.id,
          },
        });

        const walletAmount = line.walletAmount ?? 0;
        if (walletAmount > 0 && line.driverId !== order.driverId) {
          await tx.driverWalletTransaction.create({
            data: {
              driverId: order.driverId,
              type: "SETTLEMENT",
              amount: walletAmount,
              date: order.date,
              dailyOrderId: orderId,
              descriptionAr: `نقل تحصيل إلى سائق بديل (توزيع طلبات ${dateStr})`,
            },
          });

          await tx.driverWalletTransaction.create({
            data: {
              driverId: line.driverId,
              type: "CHARGE",
              amount: walletAmount,
              date: order.date,
              dailyOrderId: orderId,
              descriptionAr: `تحصيل موزع من حساب السائق الأصلي (${dateStr})`,
            },
          });
        }
      }

      await recomputeDriverWalletStates(tx, [
        order.driverId,
        ...priorAllocations.map((allocation) => allocation.driverId),
        ...driverIds,
      ]);
    });

    return NextResponse.json({ success: true, allocated: lines.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في توزيع الطلبات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
