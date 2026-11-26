import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAdvanceSalaryJournal, lockAdvanceCompany, prepareAdvanceSalary, reserveAdvanceInstallments, validateReservedAdvances } from "@/lib/hr/employee-advances";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { discardLinkedJournalEntry, ensureLinkedJournalEntryIsMutable } from "@/lib/accounting/journal-engine";
import { salaryAdjustmentDetailsSchema } from "@/lib/hr/salary-adjustments";
import { linkSalaryItemsToPayments } from "@/lib/hr/salary-items";
import { linkViolationInstallmentsToPayments, reserveViolationInstallments, settleViolationInstallments } from "@/lib/hr/driver-violation-installments";

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
    vehicleRentDeduction: z.number().min(0).default(0),
    housingDeduction: z.number().min(0).default(0),
    adjustmentDetails: salaryAdjustmentDetailsSchema,
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

function ensureBatchIsDeletable(status: string) {
  if (status !== "DRAFT" && status !== "APPROVED" && status !== "CANCELLED") {
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
      await lockAdvanceCompany(tx, batch.companyId);
      const current = await tx.salaryBatch.findUniqueOrThrow({ where: { id: batchId } });
      if ((current.status === "PAID" || current.status === "CANCELLED") && parsed.data.status && parsed.data.status !== current.status) throw new Error("لا يمكن تغيير حالة دفعة مصروفة أو ملغاة");
      if (parsed.data.status === "PAID" && current.status !== "APPROVED") throw new Error("اعتمد دفعة الرواتب قبل تأكيد صرفها");
      if (parsed.data.status === "PAID" || parsed.data.status === "APPROVED") await validateReservedAdvances(tx, batchId);
      if (parsed.data.status === "PAID") await settleViolationInstallments(tx, batchId);
      if (parsed.data.status === "CANCELLED") {
        await reserveAdvanceInstallments(tx, batchId, []);
        await reserveViolationInstallments(tx, batchId, []);
      }
      if (parsed.data.status === "CANCELLED" && current.journalEntryId) {
        await discardLinkedJournalEntry(tx, current.journalEntryId, {
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
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : AR.updateFailed }, { status: 400 });
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

    const updatedBatch = await prisma.$transaction(async (tx) => {
      await lockAdvanceCompany(tx, batch.companyId);
      const current = await tx.salaryBatch.findUniqueOrThrow({ where: { id: batchId } });
      ensureBatchIsEditable(current.status);
      const draft = await prepareAdvanceSalary(tx, batch.companyId, data.year, data.month, data.payments, getAccessibleBranchIds(session, batch.companyId), batchId);
      await discardLinkedJournalEntry(tx, current.journalEntryId, {
        userId: session.id,
        reasonAr: AR.updateReason,
      });

      await tx.salaryItem.deleteMany({ where: { batchId } });
      await tx.salaryPayment.deleteMany({ where: { batchId } });

      const updated = await tx.salaryBatch.update({
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
              advanceDeduction: payment.advanceDeduction,
              netAmount: payment.netAmount,
              notes: payment.notes,
            })),
          },
          items: {
            create: draft.items,
          },
        },
        include: { payments: true },
      });
      await linkSalaryItemsToPayments(tx, batchId, updated.payments);
      await reserveAdvanceInstallments(tx, batchId, draft.dueIds);
      await reserveViolationInstallments(tx, batchId, draft.violationDueIds);
      await linkViolationInstallmentsToPayments(tx, batchId, updated.payments);
      const violationRecoveries = draft.items.filter(item => item.sourceType === "DRIVER_VIOLATION").map(item => ({ employeeId: item.employeeId, amount: item.amount }));
      const journal = await createAdvanceSalaryJournal(tx, batch.companyId, session.id, batchId, data.month, data.year, draft.totalNet, draft.payments.reduce((sum, row) => sum + row.advanceDeduction, 0), draft.payments, violationRecoveries);
      return tx.salaryBatch.update({ where: { id: batchId }, data: { journalEntryId: journal.id } });
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

    ensureBatchIsDeletable(batch.status);
    await ensureLinkedJournalEntryIsMutable(prisma, batch.journalEntryId, AR.deleteAction);

    await prisma.$transaction(async (tx) => {
      await lockAdvanceCompany(tx, batch.companyId);
      const current = await tx.salaryBatch.findUniqueOrThrow({ where: { id: batchId } });
      ensureBatchIsDeletable(current.status);
      await reserveAdvanceInstallments(tx, batchId, []);
      await reserveViolationInstallments(tx, batchId, []);
      await discardLinkedJournalEntry(tx, current.journalEntryId, {
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
