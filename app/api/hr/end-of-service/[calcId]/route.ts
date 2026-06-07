import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Props {
  params: Promise<{ calcId: string }>;
}

const patchSchema = z.object({
  status: z.enum(["CALCULATED", "ACCRUED", "PAID"]).optional(),
  notes: z.string().optional().nullable(),
  paidDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { calcId } = await params;
    const record = await prisma.endOfServiceCalc.findUnique({ where: { id: calcId } });
    if (!record) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, record.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    if (record.journalEntryId) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن تعديل نهاية الخدمة بعد إنشاء القيد المرتبط. احذف السجل أولاً أو أنشئ سجلًا جديدًا بعد المراجعة.",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.endOfServiceCalc.update({ where: { id: calcId }, data: parsed.data });
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
    const { calcId } = await params;
    const record = await prisma.endOfServiceCalc.findUnique({
      where: { id: calcId },
      select: { id: true, companyId: true, journalEntryId: true, status: true },
    });
    if (!record) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, record.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    if (record.status === "PAID") return NextResponse.json({ success: false, error: "لا يمكن حذف سجل مصروف" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, record.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف سجل نهاية الخدمة قبل ترحيل القيد",
      });
      await tx.endOfServiceCalc.delete({ where: { id: calcId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
