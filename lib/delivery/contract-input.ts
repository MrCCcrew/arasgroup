import { z } from "zod";
import { hourlyRateSchema, parseWorkDate, workDateSchema } from "./hourly-work";

export const contractFields = z.object({
  platform: z.string().trim().max(100).nullable().optional(),
  nameAr: z.string().trim().min(2).max(191),
  nameEn: z.string().trim().max(191).nullable().optional(),
  startDate: workDateSchema.transform(value => parseWorkDate(value)!),
  endDate: workDateSchema.nullable().optional().transform(value => value == null ? value : parseWorkDate(value)!),
  notes: z.string().max(4000).nullable().optional(),
  usesLocationPricing: z.boolean().optional(),
  usesHourlyWork: z.boolean().optional(),
  defaultHourlyRate: hourlyRateSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export function contractInputError(value: { usesHourlyWork: boolean; defaultHourlyRate?: unknown; startDate: Date; endDate?: Date | null }) {
  if (value.usesHourlyWork && !value.defaultHourlyRate) return "أدخل سعر الساعة الافتراضي للعقد";
  if (value.endDate && value.endDate < value.startDate) return "تاريخ نهاية العقد يجب ألا يسبق بدايته";
  return null;
}
