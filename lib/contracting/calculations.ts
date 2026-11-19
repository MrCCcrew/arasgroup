import { Prisma } from "@prisma/client";
export const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toDecimalPlaces(3);
export type Movement = { kind: string; amount: Prisma.Decimal.Value; retention: Prisma.Decimal.Value; advanceRecovery: Prisma.Decimal.Value; netAmount: Prisma.Decimal.Value };
export function contractBalances(rows: Movement[]) {
  let claimed = money(0), retained = money(0), advance = money(0), payable = money(0), settled = money(0);
  for (const row of rows) {
    if (row.kind === "CLAIM") { claimed = claimed.add(row.amount); retained = retained.add(row.retention); advance = advance.sub(row.advanceRecovery); payable = payable.add(row.netAmount); }
    if (row.kind === "ADVANCE") advance = advance.add(row.amount);
    if (row.kind === "SETTLEMENT") { payable = payable.sub(row.amount); settled = settled.add(row.amount); }
    if (row.kind === "RETENTION_RELEASE") retained = retained.sub(row.amount);
  }
  return { claimed, retained, advance, payable, settled };
}
export function claimAmounts(amount: Prisma.Decimal.Value, retentionPercent: Prisma.Decimal.Value, recoveryPercent: Prisma.Decimal.Value, availableAdvance: Prisma.Decimal.Value) {
  const gross = money(amount);
  const retention = money(gross.mul(retentionPercent).div(100));
  const advanceRecovery = Prisma.Decimal.min(money(gross.mul(recoveryPercent).div(100)), money(availableAdvance));
  const netAmount = gross.sub(retention).sub(advanceRecovery);
  if (netAmount.isNegative()) throw new Error("خصومات المستخلص تتجاوز قيمته");
  return { amount: gross, retention, advanceRecovery, netAmount };
}
export const costAccounts: Record<string, string> = { MATERIAL: "5300", LABOUR: "5310", EQUIPMENT: "5330", OTHER: "5390" };
export function movementLines(row: Movement & { category?: string | null; cashAccountId?: string | null }, customer: boolean) {
  const lines: { code?: string; accountId?: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[] = [];
  const add = (code: string, debit: Prisma.Decimal.Value, credit: Prisma.Decimal.Value) => { if (!money(debit).isZero() || !money(credit).isZero()) lines.push({ code, debit: money(debit), credit: money(credit) }); };
  const cash = (debit: Prisma.Decimal.Value, credit: Prisma.Decimal.Value) => {
    if (!row.cashAccountId) throw new Error("اختر حساب الصندوق أو البنك");
    lines.push({ accountId: row.cashAccountId, debit: money(debit), credit: money(credit) });
  };
  if (row.kind === "CLAIM") {
    if (customer) { add("1200", row.netAmount, 0); add("1210", row.retention, 0); add("2050", row.advanceRecovery, 0); add("4060", 0, row.amount); }
    else { add("5320", row.amount, 0); add("2040", 0, row.netAmount); add("2060", 0, row.retention); add("1220", 0, row.advanceRecovery); }
  } else if (row.kind === "ADVANCE") {
    if (customer) { cash(row.amount, 0); add("2050", 0, row.amount); } else { add("1220", row.amount, 0); cash(0, row.amount); }
  } else if (row.kind === "SETTLEMENT") {
    if (customer) { cash(row.amount, 0); add("1200", 0, row.amount); } else { add("2040", row.amount, 0); cash(0, row.amount); }
  } else if (row.kind === "RETENTION_RELEASE") {
    if (customer) { cash(row.amount, 0); add("1210", 0, row.amount); } else { add("2060", row.amount, 0); cash(0, row.amount); }
  } else if (row.kind === "COST") {
    const code = costAccounts[row.category ?? ""];
    if (!code) throw new Error("اختر تصنيف التكلفة");
    add(code, row.amount, 0); cash(0, row.amount);
  } else throw new Error("نوع الحركة غير صحيح");
  const debit = lines.reduce((sum, l) => sum.add(l.debit), money(0));
  const credit = lines.reduce((sum, l) => sum.add(l.credit), money(0));
  if (!debit.eq(credit) || !debit.gt(0)) throw new Error("القيد غير متوازن");
  return { lines, total: debit };
}
