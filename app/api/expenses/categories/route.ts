import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  companyId: z.string(),
  nameAr: z.string().min(2, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  code: z.string().optional(),
  type: z.string().min(1, "النوع مطلوب"),
  parentId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const all = searchParams.get("all") === "true";

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { companyId, ...(all ? {} : { isActive: true }) },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب فئات المصروفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, nameAr, nameEn, code, type, parentId } = parsed.data;

    const existing = await prisma.expenseCategory.findUnique({
      where: { companyId_nameAr: { companyId, nameAr } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "فئة بهذا الاسم موجودة مسبقاً" }, { status: 400 });
    }

    const category = await prisma.expenseCategory.create({
      data: { companyId, nameAr, nameEn, code, type, parentId },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء الفئة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
