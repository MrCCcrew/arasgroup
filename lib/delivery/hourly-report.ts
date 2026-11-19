import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseWorkDate } from "./hourly-work";

export type WorkReportSearch = { contractId?: string; from?: string; to?: string; driverId?: string; workEntityId?: string; mode?: string };
export function reportPeriod(search: WorkReportSearch, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const from = parseWorkDate(search.from ?? "") ?? start;
  const to = parseWorkDate(search.to ?? "") ?? end;
  const until = new Date(to); until.setUTCDate(until.getUTCDate() + 1);
  return { from, until, fromString: from.toISOString().slice(0, 10), toString: to.toISOString().slice(0, 10) };
}

type SummaryInput = { driverId: string; workEntityId: string; minutes: number; ordersCount: number; amount: Prisma.Decimal | string | number; driver: { employee: { nameAr: string; nameEn: string | null } }; workEntity: { name: string } };
export function summarizeHourlyReport(rows: SummaryInput[], en = false) {
  const byDriver = new Map<string, { id: string; name: string; minutes: number; orders: number; amount: Prisma.Decimal }>();
  const byEntity = new Map<string, { id: string; name: string; minutes: number; orders: number; amount: Prisma.Decimal }>();
  let minutes = 0, orders = 0; let amount = new Prisma.Decimal(0);
  for (const row of rows) {
    minutes += row.minutes; orders += row.ordersCount; amount = amount.plus(row.amount);
    for (const [map, id, name] of [[byDriver, row.driverId, en ? row.driver.employee.nameEn || row.driver.employee.nameAr : row.driver.employee.nameAr], [byEntity, row.workEntityId, row.workEntity.name]] as const) {
      const group = map.get(id) ?? { id, name, minutes: 0, orders: 0, amount: new Prisma.Decimal(0) };
      group.minutes += row.minutes; group.orders += row.ordersCount; group.amount = group.amount.plus(row.amount); map.set(id, group);
    }
  }
  return { minutes, orders, amount, byDriver: [...byDriver.values()], byEntity: [...byEntity.values()] };
}

export async function loadHourlyReport(companyId: string, contractId: string, search: WorkReportSearch, branchIds: string[] = []) {
  const period = reportPeriod(search);
  const rows = await prisma.deliveryHourlyWorkEntry.findMany({
    where: { contractId, contract: { companyId }, date: { gte: period.from, lt: period.until }, ...(search.driverId ? { driverId: search.driverId } : {}), ...(search.workEntityId ? { workEntityId: search.workEntityId } : {}), ...(branchIds.length ? { driver: { employee: { branchId: { in: branchIds } } } } : {}) },
    include: { driver: { select: { employee: { select: { nameAr: true, nameEn: true } } } }, workEntity: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { id: "asc" }],
  });
  return { rows, period };
}
