import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const createBankAccountSchema = z.object({
  companyId: z.string(),
  nameAr: z.string().min(1, "اسم الحساب مطلوب"),
  nameEn: z.string().optional().nullable(),
  bankName: z.string().min(1, "اسم البنك مطلوب"),
  accountNumber: z.string().min(1, "رقم الحساب مطلوب"),
  iban: z.string().optional().nullable(),
  currency: z.string().optional(),
  isDefault: z.boolean().optional(),
  chartAccountId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const linkedOnly = searchParams.get("linkedOnly") === "true";

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "BANKS", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const accounts = await prisma.bankAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(linkedOnly ? { chartAccountId: { not: null } } : {}),
      },
      include: {
        chartAccount: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { nameAr: "asc" }],
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب الحسابات البنكية" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = createBankAccountSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, nameAr, nameEn, bankName, accountNumber, iban, currency, isDefault, chartAccountId } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "BANKS", "CREATE", { companyId });
    if (permissionError) return permissionError;

    if (chartAccountId) {
      const chartAccount = await prisma.chartOfAccount.findFirst({
        where: { id: chartAccountId, companyId, isActive: true, isHeader: false, type: "ASSET" },
      });
      if (!chartAccount) {
        return NextResponse.json(
          { success: false, error: "الحساب المرتبط يجب أن يكون حساب أصل نشط من دليل الحسابات" },
          { status: 400 },
        );
      }
    }

    if (isDefault) {
      await prisma.bankAccount.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    const account = await prisma.bankAccount.create({
      data: {
        companyId,
        nameAr,
        nameEn,
        bankName,
        accountNumber,
        iban,
        currency: currency ?? "KWD",
        isDefault: isDefault ?? false,
        chartAccountId: chartAccountId ?? null,
      },
      include: {
        chartAccount: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إنشاء الحساب البنكي";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
