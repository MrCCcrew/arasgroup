import { Prisma } from "@prisma/client";
import { z } from "zod";

export const hourlyRateSchema = z.number().finite().positive().max(100000).refine(
  value => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001,
  "سعر الساعة يقبل حتى 3 منازل عشرية",
);

export function parseWorkDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export const workDateSchema = z.string().refine(value => !!parseWorkDate(value), "التاريخ غير صالح");

export const hourlyEntrySchema = z.object({
  action: z.literal("entry"), id: z.string().optional(),
  driverId: z.string().min(1), workEntityId: z.string().min(1),
  date: workDateSchema, minutes: z.number().int().min(1).max(1440),
  ordersCount: z.number().int().min(0).max(100000).default(0),
  hourlyRate: hourlyRateSchema.optional(), notes: z.string().trim().max(4000).default(""),
});

export function resolveHourlyRate(inputRate: number | undefined, previous: { workEntityId: string; hourlyRate: Prisma.Decimal } | null, entity: { id: string; hourlyRate: Prisma.Decimal | null }, contractRate: Prisma.Decimal | null) {
  return inputRate ?? (previous?.workEntityId === entity.id ? previous.hourlyRate : null) ?? entity.hourlyRate ?? contractRate;
}

export function hourlyAmount(minutes: number, rate: string | number | Prisma.Decimal): Prisma.Decimal {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error("مدة العمل يجب أن تكون بين دقيقة و24 ساعة");
  const decimalRate = new Prisma.Decimal(rate);
  if (!decimalRate.isFinite() || decimalRate.lte(0)) throw new Error("سعر الساعة غير صالح");
  return decimalRate.mul(minutes).div(60).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}
