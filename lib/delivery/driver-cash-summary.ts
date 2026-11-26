import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * ملخص كاش السائقين — مصدر واحد للأرقام في صفحة الطلبات اليومية وتقاريرها.
 *
 *   المحصل (بعد الإكراميات) = تحصيلات الطلبات − الإكراميات
 *   صافي الرصيد            = المحصل − الفواتير − إيداع طلبات − إيداع الشركة
 *
 * إيداع طلبات = حركات DEPOSIT بطريقة "TALABAT" (أودعها السائق مباشرة لشركة طلبات).
 * إيداع الشركة = باقي حركات DEPOSIT (بنك/نقدي للشركة).
 */
export const TALABAT_DEPOSIT_METHOD = "TALABAT";

export type DriverCashRow = {
  walletBalance: number;
  collectedGross: number;
  tips: number;
  collected: number;
  invoices: number;
  talabatDeposits: number;
  companyDeposits: number;
  netBalance: number;
  orders: number;
};

const empty = (): DriverCashRow => ({
  walletBalance: 0, collectedGross: 0, tips: 0, collected: 0, invoices: 0,
  talabatDeposits: 0, companyDeposits: 0, netBalance: 0, orders: 0,
});

export function periodRange(month?: string | null, year?: string | null): { gte: Date; lte: Date } | null {
  const y = year ? Number.parseInt(year, 10) : NaN;
  if (!Number.isFinite(y)) return null;
  const m = month ? Number.parseInt(month, 10) : NaN;
  if (Number.isFinite(m) && m >= 1 && m <= 12) {
    return { gte: new Date(y, m - 1, 1, 0, 0, 0, 0), lte: new Date(y, m, 0, 23, 59, 59, 999) };
  }
  return { gte: new Date(y, 0, 1, 0, 0, 0, 0), lte: new Date(y, 11, 31, 23, 59, 59, 999) };
}

export async function getDriverCashSummary(params: {
  orderWhere: Prisma.DeliveryDailyOrderWhereInput;
  month?: string | null;
  year?: string | null;
  /** سائقين إضافيين لازم يدخلوا في الإحصائيات حتى لو مالهمش طلبات (مثلاً السائق المختار في الفلتر) */
  extraDriverIds?: string[];
}): Promise<{ byDriver: Map<string, DriverCashRow>; totals: DriverCashRow }> {
  const range = periodRange(params.month, params.year);

  const orders = await prisma.deliveryDailyOrder.findMany({
    where: params.orderWhere,
    select: { id: true, driverId: true, contractId: true, date: true, tips: true, ordersCount: true },
  });

  const driverIds = [...new Set([...orders.map((o) => o.driverId), ...(params.extraDriverIds ?? [])])];
  const byDriver = new Map<string, DriverCashRow>();
  for (const id of driverIds) byDriver.set(id, empty());
  const totals = empty();
  if (driverIds.length === 0) return { byDriver, totals };

  const [charges, periodTx, invoices] = await Promise.all([
    prisma.driverWalletTransaction.findMany({
      where: { type: "CHARGE", driverId: { in: driverIds } },
      select: { dailyOrderId: true, driverId: true, contractId: true, date: true, amount: true },
    }),
    prisma.driverWalletTransaction.findMany({
      where: { driverId: { in: driverIds }, type: { in: ["CHARGE", "DEPOSIT"] }, ...(range ? { date: range } : {}) },
      select: { driverId: true, type: true, amount: true, paymentMethod: true },
    }),
    prisma.deliveryInvoice.groupBy({
      by: ["driverId"],
      where: {
        targetType: "DRIVER",
        driverId: { in: driverIds },
        deletedAt: null,
        reviewStatus: { not: "REJECTED" },
        ...(range ? { invoiceDate: range } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const chargeByOrder = new Map<string, number>();
  const chargeByKey = new Map<string, number>();
  for (const c of charges) {
    const amount = Number(c.amount);
    if (c.dailyOrderId) chargeByOrder.set(c.dailyOrderId, (chargeByOrder.get(c.dailyOrderId) ?? 0) + amount);
    const key = `${c.driverId}|${c.contractId ?? ""}|${c.date.toISOString().slice(0, 10)}`;
    chargeByKey.set(key, (chargeByKey.get(key) ?? 0) + amount);
  }

  for (const o of orders) {
    const row = byDriver.get(o.driverId)!;
    const collection =
      chargeByOrder.get(o.id) ??
      chargeByKey.get(`${o.driverId}|${o.contractId}|${o.date.toISOString().slice(0, 10)}`) ??
      0;
    row.collectedGross += collection;
    row.tips += Number(o.tips ?? 0);
    row.orders += o.ordersCount ?? 0;
  }

  for (const tx of periodTx) {
    const row = byDriver.get(tx.driverId);
    if (!row) continue;
    const amount = Number(tx.amount);
    if (tx.type === "CHARGE") {
      row.walletBalance += amount;
    } else {
      row.walletBalance -= amount;
      if (tx.paymentMethod === TALABAT_DEPOSIT_METHOD) row.talabatDeposits += amount;
      else row.companyDeposits += amount;
    }
  }

  for (const inv of invoices) {
    const row = inv.driverId ? byDriver.get(inv.driverId) : undefined;
    if (row) row.invoices += Number(inv._sum.amount ?? 0);
  }

  for (const row of byDriver.values()) {
    row.collected = row.collectedGross - row.tips;
    row.netBalance = row.collected - row.invoices - row.talabatDeposits - row.companyDeposits;
    for (const k of Object.keys(totals) as (keyof DriverCashRow)[]) totals[k] += row[k];
  }

  return { byDriver, totals };
}
