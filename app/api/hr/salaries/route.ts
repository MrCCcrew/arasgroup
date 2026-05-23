import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSalaryPaymentJE } from "@/lib/accounting/auto-entries";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const paymentLineSchema = z.object({
  employeeId: z.string(),
  baseAmount: z.number().min(0),
  incentives: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  additionalEarnings: z.number().min(0).default(0),
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
      return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
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
    return NextResponse.json({ success: false, error: "فشل في جلب دفعات الرواتب" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createBatchSchema.safeParse(body);
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

    const payments = data.payments.map((payment) => ({
      ...payment,
      netAmount: payment.baseAmount + payment.incentives + payment.additionalEarnings - payment.deductions,
    }));

    const totalGross = payments.reduce(
      (sum, payment) => sum + payment.baseAmount + payment.incentives + payment.additionalEarnings,
      0,
    );
    const totalNet = payments.reduce((sum, payment) => sum + payment.netAmount, 0);

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.salaryBatch.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          investorId: data.investorId,
          cycleType: data.cycleType,
          month: data.month,
          year: data.year,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          totalGross,
          totalNet,
          status: "DRAFT",
          notes: data.notes,
          payments: {
            create: payments.map((payment) => ({
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
            create: payments.flatMap((payment) => {
              const items = [
                {
                  employeeId: payment.employeeId,
                  type: "BASE_SALARY",
                  category: "EARNING",
                  titleAr: "راتب أساسي",
                  titleEn: "Base Salary",
                  amount: payment.baseAmount,
                },
              ];

              if (payment.incentives > 0) {
                items.push({
                  employeeId: payment.employeeId,
                  type: "INCENTIVE",
                  category: "EARNING",
                  titleAr: "حافز",
                  titleEn: "Incentive",
                  amount: payment.incentives,
                });
              }

              if (payment.additionalEarnings > 0) {
                items.push({
                  employeeId: payment.employeeId,
                  type: "ADDITIONAL_EARNING",
                  category: "EARNING",
                  titleAr: "إضافة أخرى",
                  titleEn: "Additional Earning",
                  amount: payment.additionalEarnings,
                });
              }

              if (payment.deductions > 0) {
                items.push({
                  employeeId: payment.employeeId,
                  type: "DEDUCTION",
                  category: "DEDUCTION",
                  titleAr: "خصم",
                  titleEn: "Deduction",
                  amount: payment.deductions,
                });
              }

              return items;
            }),
          },
        },
        include: { payments: true },
      });

      return createdBatch;
    });

    await createSalaryPaymentJE({
      companyId: data.companyId,
      userId: session.id,
      totalAmount: totalNet,
      month: data.month,
      year: data.year,
      refId: batch.id,
    });

    return NextResponse.json({ success: true, data: batch }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إنشاء دفعة الرواتب";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
