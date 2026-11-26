import { z } from "zod";

export function entryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : undefined;
}

export const entrySchema = z.object({
  kind: z.enum(["revenue", "expense", "receipt", "payment"]),
  partnerId: z.string().min(1),
  date: z.string().refine(value => !!entryDate(value)),
  amount: z.number().finite().min(0.001).max(100000000).refine(value => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001),
  notes: z.string().trim().max(4000).default(""),
});

// A selected month takes precedence over the optional custom date range.
export function entryDateFilter(search: { month?: string; from?: string; to?: string }) {
  if (search.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)) {
    const gte = entryDate(`${search.month}-01`)!;
    const lt = new Date(gte);
    lt.setUTCMonth(lt.getUTCMonth() + 1);
    return { gte, lt };
  }
  const gte = entryDate(search.from ?? "");
  const lte = entryDate(search.to ?? "");
  if (lte) lte.setUTCHours(23, 59, 59, 999);
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}
