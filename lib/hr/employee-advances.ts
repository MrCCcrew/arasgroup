import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildSalaryBatchDraft, type SalaryPaymentDraftInput } from "./salary-batch-builder";
import { validateJournalEntry } from "@/lib/accounting/journal-validation";
import { dueViolationInstallments } from "@/lib/hr/driver-violation-installments";

export const advanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "التاريخ غير صالح"),
  amount: z.number().finite().positive().multipleOf(0.001).max(99999999),
  cashAccountId: z.string().min(1, "اختر الصندوق أو البنك"),
  notes: z.string().trim().max(2000).optional(),
  installments: z.array(z.object({
    year: z.number().int().min(2020).max(2200),
    month: z.number().int().min(1).max(12),
    amount: z.number().finite().positive().multipleOf(0.001).max(99999999),
  })).min(1).max(120),
}).superRefine((value, ctx) => {
  const months = value.installments.map(row => `${row.year}-${String(row.month).padStart(2, "0")}`);
  if (new Set(months).size !== months.length) ctx.addIssue({ code: "custom", message: "لا يمكن تكرار شهر السداد" });
  if (months.some(month => month < value.date.slice(0, 7))) ctx.addIssue({ code: "custom", message: "شهر السداد لا يمكن أن يسبق تاريخ السلفة" });
  if (value.installments.reduce((sum, row) => sum + Math.round(row.amount * 1000), 0) !== Math.round(value.amount * 1000)) ctx.addIssue({ code: "custom", message: "مجموع الأقساط يجب أن يساوي قيمة السلفة" });
});

export async function lockAdvanceCompany(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
}

export async function advanceAccount(tx: Prisma.TransactionClient, companyId: string) {
  let account = await tx.chartOfAccount.findUnique({ where: { companyId_code: { companyId, code: "1050" } } });
  if (!account) {
    const parent = await tx.chartOfAccount.findUnique({ where: { companyId_code: { companyId, code: "10" } } });
    if (!parent || parent.type !== "ASSET" || !parent.isHeader) throw new Error("أنشئ دليل حسابات الشركة أولاً");
    account = await tx.chartOfAccount.create({ data: { companyId, code: "1050", nameAr: "سلف الموظفين", nameEn: "Employee advances", type: "ASSET", normalBalance: "DEBIT", level: 3, parentId: parent.id, subtype: "current_asset" } });
  }
  if (account.type !== "ASSET" || account.isHeader || !account.isActive) throw new Error("حساب سلف الموظفين 1050 غير صالح أو غير نشط");
  return account.id;
}

export async function advanceJournal(tx: Prisma.TransactionClient, input: {
  companyId: string; userId: string; date: Date; description: string; refId: string; payroll?: boolean;
  lines: Array<{ accountId: string; debit: number; credit: number; employeeId?: string }>;
}) {
  validateJournalEntry(input.lines);
  let fiscal = await tx.fiscalYear.findFirst({ where: { companyId: input.companyId, startDate: { lte: input.date }, endDate: { gte: input.date } } });
  if (!fiscal) {
    const year = input.date.getUTCFullYear();
    fiscal = await tx.fiscalYear.create({ data: { companyId: input.companyId, year, startDate: new Date(`${year}-01-01`), endDate: new Date(`${year}-12-31T23:59:59.999Z`), isCurrent: false } });
  }
  if (fiscal.isLocked) throw new Error("الفترة المالية مغلقة");
  const accounts = await tx.chartOfAccount.findMany({ where: { id: { in: input.lines.map(line => line.accountId) }, companyId: input.companyId, isActive: true, isHeader: false } });
  if (accounts.length !== new Set(input.lines.map(line => line.accountId)).size) throw new Error("أحد حسابات القيد غير صالح");
  const prefix = `${input.payroll ? "SAL" : "ADV"}-${fiscal.year}-`;
  const count = await tx.journalEntry.count({ where: { companyId: input.companyId, number: { startsWith: prefix } } });
  return tx.journalEntry.create({ data: {
    companyId: input.companyId, fiscalYearId: fiscal.id, date: input.date,
    number: `${prefix}${String(count + 1).padStart(6, "0")}`, descriptionAr: input.description,
    type: input.payroll ? "SALARY" : "GENERAL", status: "DRAFT", isAutomatic: true,
    refModule: input.payroll ? "hr" : "employee_advances", refId: input.refId, createdById: input.userId,
    totalDebit: input.lines.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0)),
    totalCredit: input.lines.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0)),
    lines: { create: input.lines.map((line, sortOrder) => ({ ...line, sortOrder })) },
  } });
}

export async function trafficFinePayableAccount(tx: Prisma.TransactionClient, companyId: string) {
  let account = await tx.chartOfAccount.findUnique({ where: { companyId_code: { companyId, code: "2023" } } });
  if (!account) {
    const parent = await tx.chartOfAccount.findUnique({ where: { companyId_code: { companyId, code: "20" } } });
    if (!parent || parent.type !== "LIABILITY" || !parent.isHeader) throw new Error("دليل حسابات الالتزامات غير صالح");
    account = await tx.chartOfAccount.create({ data: { companyId, code: "2023", nameAr: "مخالفات مرورية مستحقة لإدارة المرور", nameEn: "Traffic fines payable", type: "LIABILITY", normalBalance: "CREDIT", level: 3, parentId: parent.id, subtype: "current_liability" } });
  }
  if (account.type !== "LIABILITY" || account.isHeader || !account.isActive) throw new Error("حساب مخالفات المرور المستحقة غير صالح أو غير نشط");
  return account.id;
}

export async function dueAdvanceInstallments(db: Prisma.TransactionClient | typeof prisma, companyId: string, year: number, month: number, batchId?: string, employeeIds?: string[]) {
  return db.employeeAdvanceInstallment.findMany({ where: {
    year, month, advance: { companyId, isCancelled: false, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
    OR: [{ batchId: null }, ...(batchId ? [{ batchId }] : [])],
  }, include: { advance: { select: { employeeId: true, id: true, journalEntryId: true } } }, orderBy: { id: "asc" } });
}

export async function prepareAdvanceSalary(tx: Prisma.TransactionClient, companyId: string, year: number, month: number, payments: SalaryPaymentDraftInput[], branchIds: string[], batchId?: string) {
  const ids = payments.map(payment => payment.employeeId);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("اختر موظفين بدون تكرار");
  const employees = await tx.employee.count({ where: {
    id: { in: ids }, isDeleted: false,
    AND: [
      {
        OR: [
          { residencyLicense: { companyId } },
          // Until a residency is recorded, legacy employees are paid by their direct company.
          { companyId, residencyLicenseId: null },
        ],
      },
      ...(branchIds.length ? [{ OR: [{ branchId: { in: branchIds } }, { branchId: null }] }] : []),
    ],
  } });
  if (employees !== ids.length) throw new Error("أحد الموظفين لا تتبع إقامته للشركة المختارة أو خارج صلاحياتك");
  // Payroll rules are enforced here (not merely in the browser) so every
  // salary creation/edit path produces the same result for order-rate drivers.
  const driverConfigs = await tx.driver.findMany({
    where: { employeeId: { in: ids } },
    select: { employeeId: true, payrollMode: true, calculatedOrderRate: true, monthlyVehicleRent: true, monthlyHousingDeduction: true },
  });
  const driverByEmployeeId = new Map(driverConfigs.map(driver => [driver.employeeId, driver]));
  const normalizedPayments = payments.map((payment) => {
    const driver = driverByEmployeeId.get(payment.employeeId);
    if (driver?.payrollMode !== "CALCULATED_ORDER_RATE") return payment;
    const orders = Math.max(0, payment.actualOrders ?? 0);
    const rate = Number(driver.calculatedOrderRate);
    return {
      ...payment,
      baseAmount: Math.round(orders * rate * 1000) / 1000,
      incentives: 0,
      foodAllowance: 0,
      targetDeduction: 0,
      vehicleRentDeduction: Number(driver.monthlyVehicleRent),
      housingDeduction: Number(driver.monthlyHousingDeduction),
    };
  });
  const due = await dueAdvanceInstallments(tx, companyId, year, month, batchId, ids);
  const dueViolations = await dueViolationInstallments(tx, companyId, year, month, ids, batchId);
  for (const row of due) {
    if (row.advance.journalEntryId) {
      const journal = await tx.journalEntry.findUnique({ where: { id: row.advance.journalEntryId } });
      if (!journal || journal.isDeleted || journal.isReversed || journal.status === "CANCELLED" || journal.status === "REJECTED") throw new Error("قيد صرف إحدى السلف ملغى أو معكوس؛ راجع السلفة أولاً");
    }
  }
  const draft = buildSalaryBatchDraft(normalizedPayments);
  for (const payment of draft.payments) {
    const rows = due.filter(row => row.advance.employeeId === payment.employeeId);
    const amount = rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    payment.advanceDeduction = Number(amount);
    payment.deductions = Number(new Prisma.Decimal(payment.deductions).plus(amount));
    payment.netAmount = Number(new Prisma.Decimal(payment.netAmount).minus(amount));
    if (amount.gt(0) && payment.netAmount < 0) throw new Error("قسط السلفة يتجاوز صافي راتب الموظف؛ عدّل جدول السداد أو بيانات الراتب");
    for (const row of rows) draft.items.push({ employeeId: payment.employeeId, type: "EMPLOYEE_ADVANCE_DEDUCTION", category: "DEDUCTION", titleAr: `قسط سلفة ${month}/${year} (${row.advance.id.slice(-6)})`, titleEn: `Advance installment ${month}/${year} (${row.advance.id.slice(-6)})`, amount: Number(row.amount) });
  }
  for (const payment of draft.payments) {
    const rows = dueViolations.filter(row => row.employeeId === payment.employeeId);
    const amount = rows.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    if (!amount.gt(0)) continue;
    payment.deductions = Number(new Prisma.Decimal(payment.deductions).plus(amount));
    payment.netAmount = Number(new Prisma.Decimal(payment.netAmount).minus(amount));
    if (payment.netAmount < 0) throw new Error("خصم مخالفات السائق يتجاوز صافي راتبه؛ عدّل جدول الأقساط أو الراتب");
    for (const row of rows) draft.items.push({
      employeeId: payment.employeeId,
      type: "DRIVER_VIOLATION_DEDUCTION",
      category: "DEDUCTION",
      titleAr: `قسط مخالفة مرورية ${month}/${year} — ${row.violation.type}`,
      titleEn: `Traffic violation installment ${month}/${year} — ${row.violation.type}`,
      amount: Number(row.amount),
      sourceType: "DRIVER_VIOLATION",
      sourceId: row.violationId,
    });
  }
  draft.totalNet = Number(draft.payments.reduce((sum, row) => sum.plus(row.netAmount), new Prisma.Decimal(0)));
  return { ...draft, dueIds: due.map(row => row.id), violationDueIds: dueViolations.map(row => row.id) };
}

export async function reserveAdvanceInstallments(tx: Prisma.TransactionClient, batchId: string, dueIds: string[]) {
  await tx.employeeAdvanceInstallment.updateMany({ where: { batchId }, data: { batchId: null } });
  if (dueIds.length) await tx.employeeAdvanceInstallment.updateMany({ where: { id: { in: dueIds }, batchId: null }, data: { batchId } });
}

export async function validateReservedAdvances(tx: Prisma.TransactionClient, batchId: string) {
  const rows = await tx.employeeAdvanceInstallment.findMany({ where: { batchId }, include: { advance: true } });
  for (const row of rows) {
    const journal = row.advance.journalEntryId ? await tx.journalEntry.findUnique({ where: { id: row.advance.journalEntryId } }) : null;
    if (row.advance.isCancelled || !journal || journal.isDeleted || journal.isReversed || journal.status === "CANCELLED" || journal.status === "REJECTED") throw new Error("قيد صرف السلفة غير صالح؛ راجعه قبل اعتماد أو صرف الرواتب");
  }
}

export async function createAdvanceSalaryJournal(tx: Prisma.TransactionClient, companyId: string, userId: string, batchId: string, month: number, year: number, net: number, advances: number, recoveries: Array<{ employeeId: string; advanceDeduction: number }> = [], violationRecoveries: Array<{ employeeId: string; amount: number }> = []) {
  const accounts = await tx.chartOfAccount.findMany({ where: { companyId, code: { in: ["5010", "1010"] } } });
  const salary = accounts.find(account => account.code === "5010");
  const bank = accounts.find(account => account.code === "1010");
  if (!salary || !bank) throw new Error("حساب الراتب أو البنك غير موجود في دليل الحسابات");
  const recoveryAccount = advances > 0 ? await advanceAccount(tx, companyId) : null;
  const violationTotal = violationRecoveries.reduce((sum, row) => sum + row.amount, 0);
  const trafficFinePayable = violationTotal > 0 ? await trafficFinePayableAccount(tx, companyId) : null;
  return advanceJournal(tx, { companyId, userId, refId: batchId, date: new Date(), payroll: true, description: `رواتب شهر ${month}/${year}`, lines: [
    { accountId: salary.id, debit: Number(new Prisma.Decimal(net).plus(advances).plus(violationTotal)), credit: 0 },
    ...(net > 0 ? [{ accountId: bank.id, debit: 0, credit: net }] : []),
    ...(recoveryAccount ? recoveries.filter(row => row.advanceDeduction > 0).map(row => ({ accountId: recoveryAccount, debit: 0, credit: row.advanceDeduction, employeeId: row.employeeId })) : []),
    ...(trafficFinePayable ? violationRecoveries.filter(row => row.amount > 0).map(row => ({ accountId: trafficFinePayable, debit: 0, credit: row.amount, employeeId: row.employeeId })) : []),
  ] });
}
