import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Props {
  params: Promise<{ expenseId: string }>;
}

const patchSchema = z.object({
  categoryId: z.string().optional(),
  date: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  amount: z.number().positive().optional(),
  descriptionAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK", "CARD", "CHEQUE"]).optional(),
  bankAccountId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { expenseId } = await params;
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, isDeleted: false },
      select: { id: true, companyId: true, journalEntryId: true },
    });
    if (!expense) return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, expense.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (expense.journalEntryId) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن تعديل المصروف بعد إنشاء القيد المرتبط. احذف المصروف أو ألغ العملية ثم سجله من جديد حتى لا يبقى القيد غير مطابق.",
        },
        { status: 400 },
      );
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
      select: { id: true, companyId: true, journalEntryId: true, isDeleted: true, carWashExpense: { select: { id: true } } },
    });
    if (!expense || expense.isDeleted) {
      return NextResponse.json({ success: false, error: "المصروف غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, expense.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    if (expense.carWashExpense) {
      return NextResponse.json(
        { success: false, error: "This expense is linked to a car-wash operation and must be cancelled from that operation to keep the records aligned." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, expense.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف المصروف المرتبط قبل ترحيل القيد",
      });

      await tx.expense.update({
        where: { id: expenseId },
        data: { isDeleted: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
