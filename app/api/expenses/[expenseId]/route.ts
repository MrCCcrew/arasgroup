import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props {
  params: Promise<{ expenseId: string }>;
}

const patchSchema = z.object({
  categoryId: z.string().optional(),
  date: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  amount: z.number().positive().optional(),
  descriptionAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHEQUE"]).optional(),
  bankAccountId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { expenseId } = await params;
    const expense = await prisma.expense.findUnique({ where: { id: expenseId, isDeleted: false } });
    if (!expense) return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, expense.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.expense.update({ where: { id: expenseId }, data: parsed.data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { expenseId } = await params;
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, companyId: true, journalEntryId: true, isDeleted: true },
    });
    if (!expense || expense.isDeleted) {
      return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, expense.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: { isDeleted: true },
      });
      if (expense.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: expense.journalEntryId },
          data: { status: "CANCELLED", descriptionAr: "ملغى — تم حذف المصروف المرتبط" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
