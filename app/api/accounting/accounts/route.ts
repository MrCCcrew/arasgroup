import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createAccountSchema = z.object({
  companyId: z.string(),
  code: z.string().min(1, "رمز الحساب مطلوب"),
  nameAr: z.string().min(2, "اسم الحساب مطلوب"),
  nameEn: z.string().optional(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subtype: z.string().optional(),
  parentId: z.string().optional(),
  isHeader: z.boolean().default(false),
  normalBalance: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const type = searchParams.get("type");
    const isHeader = searchParams.get("isHeader");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(type ? { type: type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" } : {}),
        ...(isHeader !== null ? { isHeader: isHeader === "true" } : {}),
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب الحسابات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    // Determine level
    let level = 1;
    if (data.parentId) {
      const parent = await prisma.chartOfAccount.findUnique({ where: { id: data.parentId } });
      if (parent) level = parent.level + 1;
    }

    const account = await prisma.chartOfAccount.create({
      data: { ...data, level },
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: "رمز الحساب موجود بالفعل" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "فشل في إنشاء الحساب" }, { status: 500 });
  }
}
