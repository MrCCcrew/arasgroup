import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

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
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { accountId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.isDefault) {
      const existing = await prisma.bankAccount.findUnique({ where: { id: accountId }, select: { companyId: true } });
      if (existing) {
        await prisma.bankAccount.updateMany({ where: { companyId: existing.companyId }, data: { isDefault: false } });
      }
    }

    const account = await prisma.bankAccount.update({ where: { id: accountId }, data: parsed.data });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث الحساب";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { accountId } = await params;

    const expenseCount = await prisma.expense.count({ where: { bankAccountId: accountId, isDeleted: false } });
    if (expenseCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الحساب — مرتبط بـ ${expenseCount} مصروف` },
        { status: 400 }
      );
    }

    await prisma.bankAccount.update({ where: { id: accountId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الحساب";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
