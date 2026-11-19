export type WorkInjuryCardStatus = "ok" | "warning" | "danger";

/**
 * A quarterly no-injury report remains current through the month following the
 * reported quarter. For example, Q1 (Jan-Mar) expires on 1 May.
 */
export function workInjuryQuarterExpiryDate(year: number, quarter: number): Date {
  const expiryMonthByQuarter: Record<number, number> = { 1: 4, 2: 7, 3: 10, 4: 1 };
  const expiryYear = quarter === 4 ? year + 1 : year;
  return new Date(Date.UTC(expiryYear, expiryMonthByQuarter[quarter] ?? 1, 1));
}

export function workInjuryDateStatus(date: Date | string | null | undefined, now = new Date()): WorkInjuryCardStatus {
  if (!date) return "ok";
  const due = new Date(date);
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "danger";
  return days <= 30 ? "warning" : "ok";
}

export function isWorkInjuryDueSoon(date: Date | string | null | undefined, now = new Date(), days = 30) {
  if (!date) return false;
  const due = new Date(date).getTime();
  return due >= now.getTime() && due <= now.getTime() + days * 86400000;
}
