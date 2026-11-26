import { Prisma, type PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

function round3(value: number) { return Math.round(value * 1000) / 1000; }

function addMonths(year: number, month: number, offset: number) {
  const zeroBased = year * 12 + (month - 1) + offset;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

function driverShare(violation: { amount: Prisma.Decimal | number; responsibility: string; driverSharePct: number | null }) {
  const amount = Number(violation.amount);
  if (violation.responsibility === "DRIVER") return amount;
  if (violation.responsibility === "SPLIT") return round3(amount * (violation.driverSharePct ?? 50) / 100);
  return 0;
}

export function buildViolationInstallments(input: {
  amount: Prisma.Decimal | number;
  responsibility: string;
  driverSharePct: number | null;
  paymentMode: string;
  installmentMonths: number | null;
  installmentStartYear: number;
  installmentStartMonth: number;
}) {
  const total = driverShare(input);
  if (total <= 0) return [];
  const count = input.paymentMode === "INSTALLMENT" ? Math.max(1, input.installmentMonths ?? 1) : 1;
  const base = Math.floor((total * 1000) / count) / 1000;
  let remaining = Math.round(total * 1000);
  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(input.installmentStartYear, input.installmentStartMonth, index);
    const amount = index === count - 1 ? remaining / 1000 : base;
    remaining -= Math.round(amount * 1000);
    return { ...date, amount };
  });
}

export async function createViolationInstallments(tx: Tx, violation: {
  id: string; employeeId: string | null; driverId: string | null; amount: Prisma.Decimal | number;
  responsibility: string; driverSharePct: number | null; paymentMode: string; installmentMonths: number | null;
  installmentStartYear: number | null; installmentStartMonth: number | null; date: Date; installmentsPaid?: number;
}) {
  let employeeId = violation.employeeId;
  if (!employeeId && violation.driverId) {
    employeeId = (await tx.driver.findUnique({ where: { id: violation.driverId }, select: { employeeId: true } }))?.employeeId ?? null;
  }
  if (!employeeId) return [];
  const startYear = violation.installmentStartYear ?? violation.date.getUTCFullYear();
  const startMonth = violation.installmentStartMonth ?? violation.date.getUTCMonth() + 1;
  const rows = buildViolationInstallments({ ...violation, installmentStartYear: startYear, installmentStartMonth: startMonth });
  if (!rows.length) return [];
  const paidCount = violation.installmentsPaid ?? 0;
  await tx.driverViolationInstallment.createMany({
    data: rows.map((row, index) => ({
      violationId: violation.id,
      employeeId,
      year: row.year,
      month: row.month,
      amount: row.amount,
      settledAt: index < paidCount ? new Date() : null,
    })),
    skipDuplicates: true,
  });
  return rows;
}

export async function ensureViolationInstallments(db: Db, companyId: string, employeeIds: string[]) {
  if (!employeeIds.length) return;
  const violations = await db.driverViolation.findMany({
    where: {
      companyId,
      status: "PENDING",
      responsibility: { in: ["DRIVER", "SPLIT"] },
      OR: [{ employeeId: { in: employeeIds } }, { driver: { employeeId: { in: employeeIds } } }],
    },
    select: {
      id: true, employeeId: true, driverId: true, amount: true, responsibility: true, driverSharePct: true,
      paymentMode: true, installmentMonths: true, installmentStartYear: true, installmentStartMonth: true,
      date: true, installmentsPaid: true, installments: { select: { id: true }, take: 1 },
    },
  });
  for (const violation of violations) {
    if (!violation.installments.length) await createViolationInstallments(db as Tx, violation);
  }
}

export async function dueViolationInstallments(tx: Tx, companyId: string, year: number, month: number, employeeIds: string[], batchId?: string) {
  await ensureViolationInstallments(tx, companyId, employeeIds);
  return tx.driverViolationInstallment.findMany({
    where: {
      year, month, employeeId: { in: employeeIds }, settledAt: null,
      violation: { companyId, status: "PENDING" },
      OR: [{ batchId: null }, ...(batchId ? [{ batchId }] : [])],
    },
    include: { violation: { select: { id: true, type: true } } },
    orderBy: { id: "asc" },
  });
}

export async function reserveViolationInstallments(tx: Tx, batchId: string, ids: string[]) {
  await tx.driverViolationInstallment.updateMany({ where: { batchId }, data: { batchId: null, salaryPaymentId: null } });
  if (ids.length) await tx.driverViolationInstallment.updateMany({ where: { id: { in: ids }, batchId: null, settledAt: null }, data: { batchId } });
}

export async function linkViolationInstallmentsToPayments(tx: Tx, batchId: string, payments: Array<{ id: string; employeeId: string }>) {
  for (const payment of payments) {
    await tx.driverViolationInstallment.updateMany({ where: { batchId, employeeId: payment.employeeId }, data: { salaryPaymentId: payment.id } });
  }
}

export async function settleViolationInstallments(tx: Tx, batchId: string) {
  const due = await tx.driverViolationInstallment.findMany({ where: { batchId, settledAt: null }, select: { id: true, violationId: true } });
  if (!due.length) return;
  await tx.driverViolationInstallment.updateMany({ where: { id: { in: due.map(row => row.id) } }, data: { settledAt: new Date() } });
  const ids = [...new Set(due.map(row => row.violationId))];
  for (const violationId of ids) {
    const [total, paid] = await Promise.all([
      tx.driverViolationInstallment.count({ where: { violationId } }),
      tx.driverViolationInstallment.count({ where: { violationId, settledAt: { not: null } } }),
    ]);
    await tx.driverViolation.update({ where: { id: violationId }, data: { installmentsPaid: paid, status: paid >= total ? "SETTLED" : "PENDING" } });
  }
}
