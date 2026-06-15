import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSalaryPaymentJE } from "@/lib/accounting/auto-entries";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { buildSalaryBatchDraft } from "@/lib/hr/salary-batch-builder";

const AR = {
  companyRequired: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0634\u0631\u0643\u0629 \u0645\u0637\u0644\u0648\u0628",
  fetchFailed: "\u0641\u0634\u0644 \u0641\u064a \u062c\u0644\u0628 \u062f\u0641\u0639\u0627\u062a \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  createFailed: "\u0641\u0634\u0644 \u0641\u064a \u0625\u0646\u0634\u0627\u0621 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
};

const paymentLineSchema = z.object({
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
});

const createBatchSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  investorId: z.string().optional(),
  cycleType: z.enum([
    "OWNER_STANDARD",
    "ADMINISTRATIVE_26_DAY",
    "DELIVERY_28_DAY",
    "CAR_WASH_28_DAY",
    "INVESTOR_FIXED",
  ]).default("OWNER_STANDARD"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  periodStart: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  periodEnd: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  payments: z.array(paymentLineSchema),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: AR.companyRequired }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const batches = await prisma.salaryBatch.findMany({
      where: { companyId },
      include: {
        payments: {
          include: { employee: { select: { nameAr: true, type: true } } },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ success: true, data: batches });
  } catch {
    return NextResponse.json({ success: false, error: AR.fetchFailed }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = createBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "CREATE", {
      companyId: data.companyId,
      branchId: data.branchId,
    });
    if (permissionError) return permissionError;

    const draft = buildSalaryBatchDraft(data.payments);

    const batch = await prisma.$transaction(async (tx) => (
      tx.salaryBatch.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          investorId: data.investorId,
          cycleType: data.cycleType,
          month: data.month,
          year: data.year,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          totalGross: draft.totalGross,
          totalNet: draft.totalNet,
          status: "DRAFT",
          notes: data.notes,
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
        include: { payments: true },
      })
    ));

    const salaryJournalEntry = await createSalaryPaymentJE({
      companyId: data.companyId,
      userId: session.id,
      totalAmount: draft.totalNet,
      month: data.month,
      year: data.year,
      refId: batch.id,
    });

    await prisma.salaryBatch.update({
      where: { id: batch.id },
      data: { journalEntryId: salaryJournalEntry.id },
    });

    return NextResponse.json({ success: true, data: batch }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : AR.createFailed;
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
