import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

/**
 * توصيلات نظام المطاعم والأماكن (مرجعي فقط — لا يؤثر على أي حسابات/محافظ/أستاذ).
 * GET ?contractId&driverId&date  → توصيلات سائق في يوم.
 * GET ?contractId&date           → كل توصيلات اليوم (لكل السواقين) — للتقرير.
 */
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const driverId = searchParams.get("driverId");
  const dateStr = searchParams.get("date");
  if (!contractId || !dateStr) {
    return NextResponse.json({ success: false, error: "contractId و date مطلوبان" }, { status: 400 });
  }

  const date = new Date(dateStr);
  const dayStart = new Date(`${dateStr}T00:00:00.000`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999`);

  const deliveries = await prisma.deliveryOrderDelivery.findMany({
    where: {
      contractId,
      ...(driverId ? { driverId } : {}),
      date: { gte: dayStart, lte: dayEnd },
    },
    include: {
      restaurant: { select: { nameAr: true } },
      location: { select: { nameAr: true } },
      driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: deliveries.map((d) => ({
      id: d.id,
      driverId: d.driverId,
      restaurantId: d.restaurantId,
      locationId: d.locationId,
      restaurantName: d.restaurant.nameAr,
      locationName: d.location.nameAr,
      driverName: d.driver.employee.nameAr,
      price: Number(d.price),
    })),
    date: date.toISOString(),
  });
}

const postSchema = z.object({
  companyId: z.string().min(1),
  contractId: z.string().min(1),
  driverId: z.string().min(1),
  date: z.string().min(1),
  deliveries: z
    .array(
      z.object({
        restaurantId: z.string().min(1),
        locationId: z.string().min(1),
        price: z.number().min(0),
      }),
    )
    .default([]),
});

/**
 * يستبدل توصيلات (سائق + عقد + يوم) بالكامل بالمجموعة المُرسَلة. مرجعي فقط.
 */
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { companyId, contractId, driverId, date, deliveries } = parsed.data;
    const dayStart = new Date(`${date}T00:00:00.000`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    const recordDate = new Date(`${date}T12:00:00.000`);

    const count = await prisma.$transaction(async (tx) => {
      await tx.deliveryOrderDelivery.deleteMany({
        where: { contractId, driverId, date: { gte: dayStart, lte: dayEnd } },
      });
      if (deliveries.length > 0) {
        await tx.deliveryOrderDelivery.createMany({
          data: deliveries.map((d) => ({
            companyId,
            contractId,
            driverId,
            date: recordDate,
            restaurantId: d.restaurantId,
            locationId: d.locationId,
            price: d.price,
            createdById: session.id,
          })),
        });
      }
      return deliveries.length;
    });

    return NextResponse.json({ success: true, saved: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ التوصيلات";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
