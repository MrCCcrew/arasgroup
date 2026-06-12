import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ contractId: string }>;
}

/** إعدادات نظام المطاعم والأماكن لعقد: المطاعم + الأماكن + مصفوفة الأسعار (مطعم×مكان). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { contractId } = await params;
  const [restaurants, locations, prices] = await Promise.all([
    prisma.deliveryRestaurant.findMany({ where: { contractId, isActive: true }, orderBy: { nameAr: "asc" } }),
    prisma.deliveryLocation.findMany({ where: { contractId, isActive: true }, orderBy: { nameAr: "asc" } }),
    prisma.deliveryDeliveryPrice.findMany({ where: { contractId } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      restaurants: restaurants.map((r) => ({ id: r.id, nameAr: r.nameAr })),
      locations: locations.map((l) => ({ id: l.id, nameAr: l.nameAr })),
      prices: prices.map((p) => ({ restaurantId: p.restaurantId, locationId: p.locationId, price: Number(p.price) })),
    },
  });
}

const addSchema = z.object({
  kind: z.enum(["restaurant", "location"]),
  nameAr: z.string().min(1, "الاسم مطلوب"),
});

/** إضافة مطعم أو مكان. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { kind, nameAr } = parsed.data;
    const created =
      kind === "restaurant"
        ? await prisma.deliveryRestaurant.create({ data: { contractId, nameAr } })
        : await prisma.deliveryLocation.create({ data: { contractId, nameAr } });
    return NextResponse.json({ success: true, data: { id: created.id, nameAr: created.nameAr } }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الإضافة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

const priceSchema = z.object({
  restaurantId: z.string().min(1),
  locationId: z.string().min(1),
  price: z.number().min(0),
});

/** تحديد/تحديث سعر (مطعم + مكان). price=0 (أو لا قيمة) يحذف السعر. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;
    const parsed = priceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { restaurantId, locationId, price } = parsed.data;

    const existing = await prisma.deliveryDeliveryPrice.findUnique({
      where: { restaurantId_locationId: { restaurantId, locationId } },
    });

    if (price <= 0) {
      if (existing) await prisma.deliveryDeliveryPrice.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true });
    }

    if (existing) {
      await prisma.deliveryDeliveryPrice.update({ where: { id: existing.id }, data: { price } });
    } else {
      await prisma.deliveryDeliveryPrice.create({ data: { contractId, restaurantId, locationId, price } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ السعر";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

const deleteSchema = z.object({
  kind: z.enum(["restaurant", "location"]),
  id: z.string().min(1),
});

/** حذف مطعم أو مكان (تعطيل). */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    await params;
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { kind, id } = parsed.data;
    if (kind === "restaurant") {
      await prisma.deliveryRestaurant.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.deliveryLocation.update({ where: { id }, data: { isActive: false } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
