import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  findDailyOrderWalletCharge,
  recomputeDriverWalletStates,
  syncDailyOrderWalletCharge,
} from "@/lib/delivery/wallet-state";

interface Ctx {
  params: Promise<{ orderId: string }>;
}

const patchSchema = z.object({
  ordersCount: z.number().int().min(0).optional(),
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

  return NextResponse.json({ success: true, data: result });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;

  await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryDailyOrder.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, contractId: true, date: true },
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
  });

  return NextResponse.json({ success: true });
}
