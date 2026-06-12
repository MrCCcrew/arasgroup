import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  findDailyOrderWalletCharge,
  recomputeDriverWalletStates,
  syncDailyOrderWalletCharge,
} from "@/lib/delivery/wallet-state";
import { reconcileDriverChargeJEs } from "@/lib/delivery/charge-gl";

interface Ctx {
  params: Promise<{ orderId: string }>;
}

const patchSchema = z.object({
  ordersCount: z.number().int().min(0).optional(),
  operatedAsDriverId: z.string().nullable().optional(),
  workStatus: z.enum(["WORKED", "ON_LEAVE", "VEHICLE_BREAKDOWN", "NO_SHIFTS", "MISSED_SHIFT", "LATE_LOGIN"]).optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  walletAmount: z.number().min(0).nullable().optional(),
});

const buildWalletDescription = (date: Date) => `تحصيل يومي — ${date.toISOString().slice(0, 10)}`;

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;
  const order = await prisma.deliveryDailyOrder.findUnique({
    where: { id: orderId },
    include: {
      driver: { include: { employee: { select: { nameAr: true } } } },
      operatedAsDriver: { include: { employee: { select: { nameAr: true } } } },
      contract: { select: { nameAr: true, platform: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
  }

  const walletCharge = await findDailyOrderWalletCharge(prisma, {
    dailyOrderId: order.id,
    driverId: order.driverId,
    contractId: order.contractId,
    date: order.date,
  });

  return NextResponse.json({
    success: true,
    data: {
      ...order,
      walletChargeId: walletCharge?.id ?? null,
      walletAmount: walletCharge ? Number(walletCharge.amount) : null,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { walletAmount, ...orderFields } = parsed.data;
  const orderData: Record<string, unknown> = {};
  if (orderFields.ordersCount !== undefined) orderData.ordersCount = orderFields.ordersCount;
  if (orderFields.operatedAsDriverId !== undefined) orderData.operatedAsDriverId = orderFields.operatedAsDriverId;
  if (orderFields.workStatus !== undefined) orderData.workStatus = orderFields.workStatus;
  if (orderFields.rating !== undefined) orderData.rating = orderFields.rating;
  if (orderFields.notes !== undefined) orderData.notes = orderFields.notes;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryDailyOrder.update({
      where: { id: orderId },
      data: orderData,
    });

    if (walletAmount !== undefined) {
      await syncDailyOrderWalletCharge(tx, {
        dailyOrderId: order.id,
        driverId: order.driverId,
        contractId: order.contractId,
        date: order.date,
        amount: walletAmount,
        descriptionAr: buildWalletDescription(order.date),
      });

      await recomputeDriverWalletStates(tx, [order.driverId]);
    }

    return order;
  });

  try {
    await reconcileDriverChargeJEs({ companyId: result.companyId, userId: session.id, driverIds: [result.driverId] });
  } catch (glError) {
    console.error("charge GL reconcile failed:", glError);
  }

  return NextResponse.json({ success: true, data: result });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;

  const deleted = await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryDailyOrder.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, contractId: true, date: true, companyId: true },
    });
    if (!order) {
      throw new Error("السجل غير موجود");
    }

    const walletCharge = await findDailyOrderWalletCharge(tx, {
      dailyOrderId: order.id,
      driverId: order.driverId,
      contractId: order.contractId,
      date: order.date,
    });

    if (walletCharge) {
      await tx.driverWalletTransaction.delete({ where: { id: walletCharge.id } });
    }

    await tx.deliveryDailyOrder.delete({ where: { id: orderId } });
    await recomputeDriverWalletStates(tx, [order.driverId]);
    return { driverId: order.driverId, companyId: order.companyId };
  });

  // تنظيف قيد التحصيل اليتيم بعد حذف السجل
  try {
    await reconcileDriverChargeJEs({ companyId: deleted.companyId, userId: session.id, driverIds: [deleted.driverId] });
  } catch (glError) {
    console.error("charge GL reconcile failed:", glError);
  }

  return NextResponse.json({ success: true });
}
