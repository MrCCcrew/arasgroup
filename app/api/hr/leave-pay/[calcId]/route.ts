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

const putSchema = z.object({
  employeeId: z.string(),
  year: z.number().int(),
  periodStartDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  periodEndDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  leaveDaysUsed: z.number().min(0),
  daysOwed: z.number().min(0),
  daysPaid: z.number().min(0),
  dailyWage: z.number().min(0),
  totalAmount: z.number().min(0),
  action: z.enum(["CALCULATE", "ACCRUE", "PAY"]),
  paymentMethod: z.enum(["CASH", "BANK"]).nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { calcId } = await params;
    const record = await prisma.leavePayCalc.findUnique({
      where: { id: calcId },
      include: {
        employee: {
          select: {
            nameAr: true,
            nameEn: true,
            employeeNumber: true,
          },
        },
      },
    });

    if (!record) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, record.companyId);
    if (companyAccessError) return companyAccessError;

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في جلب البيانات";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { calcId } = await params;
    const record = await prisma.leavePayCalc.findUnique({ where: { id: calcId } });
    if (!record) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, record.companyId);
    if (companyAccessError) return companyAccessError;

    if (record.journalEntryId) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن تعديل بدل الإجازة بعد إنشاء القيد المرتبط. احذف السجل أولاً أو أنشئ سجلًا جديدًا بعد المراجعة.",
        },
        { status: 400 },
      );
    }

    if (record.status === "PAID") {
      return NextResponse.json({ success: false, error: "لا يمكن تعديل سجل مصروف" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const data = parsed.data;
    const status = data.action === "PAY" ? "PAID" : data.action === "ACCRUE" ? "ACCRUED" : "CALCULATED";

    const updated = await prisma.leavePayCalc.update({
      where: { id: calcId },
      data: {
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate,
        leaveDaysUsed: data.leaveDaysUsed,
        leaveDaysOwed: data.daysOwed,
        leaveDaysPaid: data.daysPaid,
        dailyWage: data.dailyWage,
        totalAmount: data.totalAmount,
        status,
        notes: data.notes,
        paidDate: status === "PAID" ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { calcId } = await params;
    const record = await prisma.leavePayCalc.findUnique({ where: { id: calcId } });
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
          error: "لا يمكن تعديل بدل الإجازة بعد إنشاء القيد المرتبط. احذف السجل أولاً أو أنشئ سجلًا جديدًا بعد المراجعة.",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.leavePayCalc.update({ where: { id: calcId }, data: parsed.data });
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
    const record = await prisma.leavePayCalc.findUnique({
      where: { id: calcId },
      select: { id: true, companyId: true, journalEntryId: true, status: true },
    });
    if (!record) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, record.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });

    // Check if journal entry is posted (cannot delete if posted)
    if (record.journalEntryId) {
      const journalEntry = await prisma.journalEntry.findUnique({
        where: { id: record.journalEntryId },
        select: { status: true },
      });

      if (journalEntry?.status === "POSTED") {
        return NextResponse.json(
          { success: false, error: "لا يمكن حذف سجل مرتبط بقيد مرحّل. يجب عكس القيد أولاً." },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, record.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف سجل بدل الإجازة",
      });
      await tx.leavePayCalc.delete({ where: { id: calcId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
