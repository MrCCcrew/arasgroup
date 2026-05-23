import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ orderId: string }> }

const patchSchema = z.object({
  ordersCount: z.number().int().min(0).optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  walletAmount: z.number().min(0).nullable().optional(), // null = إزالة التحصيل
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(_req);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;
  const order = await prisma.deliveryDailyOrder.findUnique({
    where: { id: orderId },
    include: {
      driver: { include: { employee: { select: { nameAr: true } } } },
      contract: { select: { nameAr: true, platform: true } },
    },
  });
  if (!order) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

  // جلب حركة التحصيل اليومي (CHARGE) المرتبطة بنفس السائق والتاريخ والعقد
  const walletCharge = await prisma.driverWalletTransaction.findFirst({
    where: {
      driverId: order.driverId,
      contractId: order.contractId,
      type: "CHARGE",
      date: order.date,
    },
    select: { id: true, amount: true },
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(req);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

  const { walletAmount, ...orderFields } = parsed.data;

  const orderData: Record<string, unknown> = {};
  if (orderFields.ordersCount !== undefined) orderData.ordersCount = orderFields.ordersCount;
  if (orderFields.rating !== undefined) orderData.rating = orderFields.rating;
  if (orderFields.notes !== undefined) orderData.notes = orderFields.notes;

  const result = await prisma.$transaction(async (tx) => {
    // 1. تحديث الأوردر
    const order = await tx.deliveryDailyOrder.update({
      where: { id: orderId },
      data: orderData,
    });

    // 2. تحديث/إنشاء/حذف حركة التحصيل اليومي
    if (walletAmount !== undefined) {
      // جلب الحركة الموجودة
      const existing = await tx.driverWalletTransaction.findFirst({
        where: { driverId: order.driverId, contractId: order.contractId, type: "CHARGE", date: order.date },
      });

      if (walletAmount === null || walletAmount === 0) {
        // حذف الحركة لو موجودة
        if (existing) {
          await tx.driverWalletTransaction.delete({ where: { id: existing.id } });
          await tx.driver.update({
            where: { id: order.driverId },
            data: { walletBalance: { decrement: Number(existing.amount) } },
          });
        }
      } else if (existing) {
        // تحديث المبلغ
        const diff = walletAmount - Number(existing.amount);
        await tx.driverWalletTransaction.update({
          where: { id: existing.id },
          data: { amount: walletAmount },
        });
        if (diff !== 0) {
          await tx.driver.update({
            where: { id: order.driverId },
            data: { walletBalance: { increment: diff } },
          });
        }
      } else {
        // إنشاء حركة جديدة
        await tx.driverWalletTransaction.create({
          data: {
            driverId: order.driverId,
            contractId: order.contractId,
            type: "CHARGE",
            amount: walletAmount,
            date: order.date,
            descriptionAr: `تحصيل يومي — ${order.date.toISOString().slice(0, 10)}`,
          },
        });
        await tx.driver.update({
          where: { id: order.driverId },
          data: { walletBalance: { increment: walletAmount } },
        });
      }
    }

    return order;
  });

  return NextResponse.json({ success: true, data: result });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(_req);
  if (session instanceof NextResponse) return session;

  const { orderId } = await params;
  await prisma.deliveryDailyOrder.delete({ where: { id: orderId } });
  return NextResponse.json({ success: true });
}
