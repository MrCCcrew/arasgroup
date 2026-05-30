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
  // تفصيل الإضافات/الخصومات للسائقين
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

    const round3 = (value: number) => Math.round(value * 1000) / 1000;

    // الإضافات الإجمالية = إضافة عامة + بدل طعام + إضافة شركة + بنزين وبنشر
    // الخصومات الإجمالية = خصم عام + خصم تارجيت + خصم شركة
    const payments = data.payments.map((payment) => {
      // نحتفظ بالقيم العامة الأصلية (للموظفين غير السائقين) لترقيم البنود
      const additionalEarningsRaw = payment.additionalEarnings;
      const deductionsRaw = payment.deductions;
      const additionalEarnings = round3(
        additionalEarningsRaw + payment.foodAllowance + payment.companyAddition + payment.fuelAddition,
      );
      const deductions = round3(deductionsRaw + payment.targetDeduction + payment.companyDeduction);
      const netAmount = round3(payment.baseAmount + payment.incentives + additionalEarnings - deductions);
      return { ...payment, additionalEarnings, deductions, netAmount, additionalEarningsRaw, deductionsRaw };
    });

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
              const items: Array<{
                employeeId: string; type: string; category: string;
                titleAr: string; titleEn: string; amount: number;
              }> = [
                {
                  employeeId: payment.employeeId,
                  type: "BASE_SALARY",
                  category: "EARNING",
                  titleAr: "راتب أساسي",
                  titleEn: "Base Salary",
                  amount: payment.baseAmount,
                },
              ];

              const add = (cond: boolean, type: string, category: string, titleAr: string, titleEn: string, amount: number) => {
                if (cond && amount > 0) {
                  items.push({ employeeId: payment.employeeId, type, category, titleAr, titleEn, amount });
                }
              };

              // الإضافات (EARNING)
              add(true, "INCENTIVE", "EARNING", "حافز", "Incentive", payment.incentives);
              add(true, "FOOD_ALLOWANCE", "EARNING", "بدل طعام", "Food Allowance", payment.foodAllowance);
              add(true, "COMPANY_ADDITION", "EARNING", "إضافة شركة", "Company Addition", payment.companyAddition);
              add(true, "FUEL_ADDITION", "EARNING", "إضافة بنزين وبنشر", "Fuel & Tire Addition", payment.fuelAddition);
              add(true, "ADDITIONAL_EARNING", "EARNING", "إضافة أخرى", "Additional Earning", payment.additionalEarningsRaw);

              // الخصومات (DEDUCTION)
              add(true, "TARGET_DEDUCTION", "DEDUCTION", "خصم تارجيت", "Target Deduction", payment.targetDeduction);
              add(true, "COMPANY_DEDUCTION", "DEDUCTION", "خصم شركة", "Company Deduction", payment.companyDeduction);
              add(true, "DEDUCTION", "DEDUCTION", "خصم", "Deduction", payment.deductionsRaw);

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
