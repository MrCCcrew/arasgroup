import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  companyId: z.string(),
  platform: z.string().optional().nullable(),
  nameAr: z.string().min(2),
  nameEn: z.string().optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  notes: z.string().optional(),
  usesLocationPricing: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const contracts = await prisma.deliveryContract.findMany({
      where: { companyId, isActive: true },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({ success: true, data: contracts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في جلب العقود";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const contract = await prisma.deliveryContract.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
