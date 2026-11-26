import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";

interface Ctx { params: Promise<{ violationId: string }> }

const schema = z.object({
  paidAt: z.string().transform(value => new Date(value)),
  categoryId: z.string().min(1).optional(),
  paymentMethod: z.enum(["CASH", "BANK", "CARD", "CHEQUE"]).default("CASH"),
  bankAccountId: z.string().optional(),
  reference: z.string().trim().max(191).optional(),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { violationId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const input = parsed.data;
    const violation = await prisma.driverViolation.findUnique({
      where: { id: violationId },
      include: { employee: { select: { nameAr: true } }, driver: { include: { employee: { select: { nameAr: true } } } } },
    });
    if (!violation) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });
    const access = assertCompanyAccess(session, violation.companyId);
    if (access) return access;
    if (violation.expenseId || violation.trafficPaidAt) return NextResponse.json({ success: false, error: "تم تسجيل سداد هذه المخالفة لإدارة المرور بالفعل" }, { status: 400 });

    const companyShare = violation.responsibility === "COMPANY"
      ? Number(violation.amount)
      : violation.responsibility === "SPLIT"
        ? Math.round(Number(violation.amount) * (100 - (violation.driverSharePct ?? 50)) * 10) / 1000
        : 0;
    // A driver-only violation still needs a traffic-payment mark.  It is not
    // an expense, because the amount is recovered from the driver in payroll.
    if (companyShare <= 0) {
      const updated = await prisma.driverViolation.update({
        where: { id: violationId },
        data: { trafficPaidAt: input.paidAt, trafficPaymentReference: input.reference ?? null },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (!input.categoryId) return NextResponse.json({ success: false, error: "يلزم اختيار فئة المصروف للجزء الذي تتحمله الشركة" }, { status: 400 });
    const category = await prisma.expenseCategory.findFirst({ where: { id: input.categoryId, companyId: violation.companyId } });
    if (!category) return NextResponse.json({ success: false, error: "فئة المصروف غير صالحة" }, { status: 400 });
    const name = violation.employee?.nameAr ?? violation.driver?.employee.nameAr ?? "السائق";
    const descriptionAr = `سداد مخالفة مرور لإدارة المرور — ${name} — ${violation.type}`;

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({ data: {
        companyId: violation.companyId, branchId: violation.branchId ?? undefined, categoryId: category.id,
        date: input.paidAt, amount: companyShare, descriptionAr, paymentMethod: input.paymentMethod,
        bankAccountId: input.bankAccountId, reference: input.reference, driverId: violation.driverId,
        employeeId: violation.employeeId, vehicleId: violation.vehicleId,
      }});
      await tx.driverViolation.update({ where: { id: violationId }, data: {
        expenseId: created.id, trafficPaidAt: input.paidAt, trafficPaymentReference: input.reference ?? null,
        companyExpenseCategoryId: category.id,
      }});
      return created;
    });
    const journal = await createExpenseJE({
      companyId: violation.companyId, userId: session.id, expenseAccountCode: resolveExpenseAccountCode(category.type, "5080"),
      amount: companyShare, isCash: input.paymentMethod === "CASH", refId: expense.id, descriptionAr,
    });
    await prisma.expense.update({ where: { id: expense.id }, data: { journalEntryId: journal.id } });
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تسجيل سداد المخالفة لإدارة المرور" }, { status: 500 });
  }
}
