import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Props {
  params: Promise<{ collectionId: string }>;
}

const updateSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).optional(),
  collectedAmount: z.number().positive().optional(),
  collectedDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { collectionId } = await params;
    const collection = await prisma.investorSalaryCollection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) {
      return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, collection.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (collection.journalEntryId) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن تعديل سجل التحصيل بعد إنشاء القيد المرتبط. احذف السجل أولاً أو أنشئ سجلًا جديدًا بعد المراجعة.",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.investorSalaryCollection.update({
      where: { id: collectionId },
      data: parsed.data,
      include: { investor: { select: { nameAr: true } } },
    });

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
    const { collectionId } = await params;
    const collection = await prisma.investorSalaryCollection.findUnique({
      where: { id: collectionId },
      select: { id: true, companyId: true, journalEntryId: true, status: true },
    });
    if (!collection) {
      return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, collection.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, collection.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف سجل تحصيل الرواتب قبل ترحيل القيد",
      });

      await tx.investorSalaryCollection.delete({ where: { id: collectionId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
