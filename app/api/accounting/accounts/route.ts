import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

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
  cashFlowCategory: z.enum(["NONE", "OPERATING", "INVESTING", "FINANCING"]).default("NONE"),
  cashFlowSubcategory: z.string().max(191).nullable().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const type = searchParams.get("type");
    const isHeader = searchParams.get("isHeader");
    const cashFlowCategory = searchParams.get("cashFlowCategory");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(type ? { type: type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" } : {}),
        ...(isHeader !== null ? { isHeader: isHeader === "true" } : {}),
        ...(cashFlowCategory ? { cashFlowCategory: cashFlowCategory as "NONE" | "OPERATING" | "INVESTING" | "FINANCING" } : {}),
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
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = createAccountSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, parsed.data.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "CREATE", {
      companyId: parsed.data.companyId,
    });
    if (permissionError) return permissionError;

    let level = 1;
    if (parsed.data.parentId) {
      const parent = await prisma.chartOfAccount.findFirst({
        where: { id: parsed.data.parentId, companyId: parsed.data.companyId },
      });
      if (parent) level = parent.level + 1;
    }

    // لو كان فيه حساب بنفس الكود لكنه متوقف (محذوف soft-delete)، نعيد تفعيله
    // ونحدّث بياناته بدل رفض الإنشاء — لأن الكود يظل محجوزاً رغم الحذف.
    const existing = await prisma.chartOfAccount.findUnique({
      where: { companyId_code: { companyId: parsed.data.companyId, code: parsed.data.code } },
      select: { id: true, isActive: true },
    });
    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ success: false, error: "رمز الحساب موجود بالفعل" }, { status: 400 });
      }
      const reactivated = await prisma.chartOfAccount.update({
        where: { id: existing.id },
        data: { ...parsed.data, level, isActive: true },
      });
      return NextResponse.json({ success: true, data: reactivated, reactivated: true }, { status: 200 });
    }

    const account = await prisma.chartOfAccount.create({
      data: { ...parsed.data, level },
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ success: false, error: "رمز الحساب موجود بالفعل" }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: "فشل في إنشاء الحساب" }, { status: 500 });
  }
}
