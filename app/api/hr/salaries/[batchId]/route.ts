import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSalaryPaymentJE } from "@/lib/accounting/auto-entries";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { discardLinkedJournalEntry, ensureLinkedJournalEntryIsMutable } from "@/lib/accounting/journal-engine";
import { buildSalaryBatchDraft } from "@/lib/hr/salary-batch-builder";

interface Ctx {
  params: Promise<{ batchId: string }>;
}

const AR = {
  batchNotFound: "\u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629",
  fetchFailed: "\u0641\u0634\u0644 \u0641\u064a \u062c\u0644\u0628 \u062a\u0641\u0627\u0635\u064a\u0644 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  updateFailed: "\u0641\u0634\u0644 \u0641\u064a \u062a\u062d\u062f\u064a\u062b \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  deleteFailed: "\u0641\u0634\u0644 \u0641\u064a \u062d\u0630\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  editFailed: "\u0641\u0634\u0644 \u0641\u064a \u062a\u0639\u062f\u064a\u0644 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  immutableBatch: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0623\u0648 \u062d\u0630\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0628\u0639\u062f \u0627\u0639\u062a\u0645\u0627\u062f \u062f\u0641\u0639\u0647\u0627 \u0623\u0648 \u0625\u0644\u063a\u0627\u0626\u0647\u0627.",
  cancelReason: "\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0642\u0628\u0644 \u062a\u0631\u062d\u064a\u0644 \u0627\u0644\u0642\u064a\u062f",
  updateReason: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0642\u0628\u0644 \u062a\u0631\u062d\u064a\u0644 \u0627\u0644\u0642\u064a\u062f",
  deleteReason: "\u062a\u0645 \u062d\u0630\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0642\u0628\u0644 \u062a\u0631\u062d\u064a\u0644 \u0627\u0644\u0642\u064a\u062f",
  editAction: "\u062a\u0639\u062f\u064a\u0644 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  deleteAction: "\u062d\u0630\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
};

const statusPatchSchema = z.object({
  status: z.enum(["DRAFT", "APPROVED", "PAID", "CANCELLED"]).optional(),
  notes: z.string().optional(),
});

const updateBatchSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  payments: z.array(z.object({
    employeeId: z.string(),
    baseAmount: z.number().min(0),
    incentives: z.number().min(0).default(0),
    deductions: z.number().min(0).default(0),
    additionalEarnings: z.number().min(0).default(0),
    foodAllowance: z.number().min(0).default(0),
    companyAddition: z.number().min(0).default(0),
    fuelAddition: z.number().min(0).default(0),
    targetDeduction: z.number().min(0).default(0),
    companyDeduction: z.number().min(0).default(0),
    attendanceDays: z.number().min(0).optional(),
    evaluationScore: z.number().min(0).optional(),
    targetOrders: z.number().int().min(0).optional(),
    actualOrders: z.number().int().min(0).optional(),
    walletAmount: z.number().min(0).optional(),
    amountDeliveredByDriver: z.number().min(0).optional(),
    notes: z.string().optional(),
  })),
  notes: z.string().optional(),
});

async function loadBatch(batchId: string) {
  return prisma.salaryBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      companyId: true,
      month: true,
      year: true,
      status: true,
      cycleType: true,
      branchId: true,
      investorId: true,
      journalEntryId: true,
    },
  });
}

function ensureBatchIsEditable(status: string) {
  if (status !== "DRAFT" && status !== "APPROVED") {
    throw new Error(AR.immutableBatch);
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;

    const batch = await prisma.salaryBatch.findUnique({
      where: { id: batchId },
      include: {
        payments: {
          include: {
            employee: {
              select: {
                id: true,
                nameAr: true,
                nameEn: true,
                type: true,
                phone: true,
                baseSalary: true,
                employeeNumber: true,
              },
            },
          },
          orderBy: [{ employee: { type: "asc" } }, { employee: { nameAr: "asc" } }],
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ success: false, error: AR.batchNotFound }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    const journalEntry = batch.journalEntryId
      ? await prisma.journalEntry.findUnique({
          where: { id: batch.journalEntryId },
          select: { id: true, status: true, isDeleted: true },
        })
      : null;

    return NextResponse.json({ success: true, data: { ...batch, journalEntry } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: AR.fetchFailed }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;
    const parsed = statusPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const batch = await loadBatch(batchId);
    if (!batch) {
      return NextResponse.json({ success: false, error: AR.batchNotFound }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "UPDATE", { companyId: batch.companyId });
    if (permissionError) return permissionError;

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === "CANCELLED" && batch.journalEntryId) {
        await discardLinkedJournalEntry(tx, batch.journalEntryId, {
          userId: session.id,
          reasonAr: AR.cancelReason,
        });
      }

      return tx.salaryBatch.update({
        where: { id: batchId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: AR.updateFailed }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;
    const parsed = updateBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const batch = await loadBatch(batchId);
    if (!batch) {
      return NextResponse.json({ success: false, error: AR.batchNotFound }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "UPDATE", { companyId: batch.companyId });
    if (permissionError) return permissionError;

    ensureBatchIsEditable(batch.status);
    await ensureLinkedJournalEntryIsMutable(prisma, batch.journalEntryId, AR.editAction);

    const data = parsed.data;
    const draft = buildSalaryBatchDraft(data.payments);

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, batch.journalEntryId, {
        userId: session.id,
        reasonAr: AR.updateReason,
      });

      await tx.salaryItem.deleteMany({ where: { batchId } });
      await tx.salaryPayment.deleteMany({ where: { batchId } });

      await tx.salaryBatch.update({
        where: { id: batchId },
        data: {
          month: data.month,
          year: data.year,
          notes: data.notes,
          totalGross: draft.totalGross,
          totalNet: draft.totalNet,
          journalEntryId: null,
          payments: {
            create: draft.payments.map((payment) => ({
              employeeId: payment.employeeId,
              attendanceDays: payment.attendanceDays,
              evaluationScore: payment.evaluationScore,
              targetOrders: payment.targetOrders,
              actualOrders: payment.actualOrders,
              walletAmount: payment.walletAmount,
              amountDeliveredByDriver: payment.amountDeliveredByDriver,
              baseAmount: payment.baseAmount,
              incentives: payment.incentives,
              additionalEarnings: payment.additionalEarnings,
              deductions: payment.deductions,
              netAmount: payment.netAmount,
              notes: payment.notes,
            })),
          },
          items: {
            create: draft.items,
          },
        },
      });
    });

    const salaryJournalEntry = await createSalaryPaymentJE({
      companyId: batch.companyId,
      userId: session.id,
      totalAmount: draft.totalNet,
      month: data.month,
      year: data.year,
      refId: batchId,
    });

    const updatedBatch = await prisma.salaryBatch.update({
      where: { id: batchId },
      data: { journalEntryId: salaryJournalEntry.id },
    });

    return NextResponse.json({ success: true, data: updatedBatch });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : AR.editFailed;
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;
    const batch = await loadBatch(batchId);
    if (!batch) {
      return NextResponse.json({ success: false, error: AR.batchNotFound }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "UPDATE", { companyId: batch.companyId });
    if (permissionError) return permissionError;

    ensureBatchIsEditable(batch.status);
    await ensureLinkedJournalEntryIsMutable(prisma, batch.journalEntryId, AR.deleteAction);

    await prisma.$transaction(async (tx) => {
      await discardLinkedJournalEntry(tx, batch.journalEntryId, {
        userId: session.id,
        reasonAr: AR.deleteReason,
      });
      await tx.salaryItem.deleteMany({ where: { batchId } });
      await tx.salaryPayment.deleteMany({ where: { batchId } });
      await tx.salaryBatch.delete({ where: { id: batchId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : AR.deleteFailed;
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
