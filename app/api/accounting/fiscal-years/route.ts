import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createFYSchema = z.object({
  companyId: z.string(),
  year: z.number().int().min(2020).max(2100),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  isCurrent: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { year: "desc" },
    });

    return NextResponse.json({ success: true, data: fiscalYears });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل في جلب السنوات المالية" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createFYSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    // If setting as current, unset all others
    if (data.isCurrent) {
      await prisma.fiscalYear.updateMany({
        where: { companyId: data.companyId },
        data: { isCurrent: false },
      });
    }

    const fy = await prisma.fiscalYear.create({ data });
    return NextResponse.json({ success: true, data: fy }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل في إنشاء السنة المالية" }, { status: 500 });
  }
}
