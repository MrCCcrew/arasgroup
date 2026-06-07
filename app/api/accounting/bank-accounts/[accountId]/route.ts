import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ accountId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional().nullable(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional().nullable(),
  currency: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  chartAccountId: z.string().optional().nullable(),
});

async function getBankAccountForAccess(accountId: string) {
  return prisma.bankAccount.findUnique({
    where: { id: accountId },
    select: { id: true, companyId: true },
  });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { accountId } = await params;
    const bankAccount = await getBankAccountForAccess(accountId);
    if (!bankAccount) {
      return NextResponse.json({ success: false, error: "الحساب البنكي غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, bankAccount.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "BANKS", "UPDATE", { companyId: bankAccount.companyId });
    if (permissionError) return permissionError;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { companyId: bankAccount.companyId },
        data: { isDefault: false },
      });
    }

    if (parsed.data.chartAccountId) {
      const chartAccount = await prisma.chartOfAccount.findFirst({
        where: {
          id: parsed.data.chartAccountId,
          companyId: bankAccount.companyId,
          isActive: true,
          isHeader: false,
          type: "ASSET",
        },
      });
      if (!chartAccount) {
        return NextResponse.json(
          { success: false, error: "الحساب المرتبط يجب أن يكون حساب أصل نشط من دليل الحسابات" },
          { status: 400 },
        );
      }
    }

    const updatedAccount = await prisma.bankAccount.update({
      where: { id: accountId },
      data: parsed.data,
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

    return NextResponse.json({ success: true, data: updatedAccount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تحديث الحساب";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { accountId } = await params;
    const bankAccount = await getBankAccountForAccess(accountId);
    if (!bankAccount) {
      return NextResponse.json({ success: false, error: "الحساب البنكي غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, bankAccount.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "BANKS", "DELETE", { companyId: bankAccount.companyId });
    if (permissionError) return permissionError;

    const expenseCount = await prisma.expense.count({ where: { bankAccountId: accountId, isDeleted: false } });
    if (expenseCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الحساب - مرتبط بـ ${expenseCount} مصروف` },
        { status: 400 },
      );
    }

    await prisma.bankAccount.update({ where: { id: accountId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف الحساب";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
