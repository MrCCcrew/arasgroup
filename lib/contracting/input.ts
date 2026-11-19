import { z } from "zod";
export const amountInput = z.coerce.number().finite().min(0).max(999999999).refine(n => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.0001, "الحد الأقصى ثلاث منازل عشرية");
const positive = amountInput.refine(n => n > 0, "القيمة يجب أن تكون أكبر من صفر");
export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, "التاريخ غير صحيح");
const text = z.string().trim().min(1).max(191);
const percent = z.coerce.number().finite().min(0).max(100).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001);
export const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("project"), code: text, name: text, clientName: text, location: text.optional().or(z.literal("")), managerName: text.optional().or(z.literal("")), budget: amountInput, startDate: dateInput, endDate: dateInput.optional().or(z.literal("")) }),
  z.object({ action: z.literal("projectStatus"), projectId: text, status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED"]) }),
  z.object({ action: z.literal("projectUpdate"), projectId: text, name: text, location: z.string().max(191).optional(), managerName: z.string().max(191).optional(), budget: amountInput }),
  z.object({ action: z.literal("contractUpdate"), projectId: text, contractId: text, value: positive, reason: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal("contract"), projectId: text, number: text, kind: z.enum(["CUSTOMER", "SUBCONTRACTOR"]), partyName: text, description: z.string().max(2000).optional(), value: positive, retentionPercent: percent.default(0), advanceRecoveryPercent: percent.default(0) }),
  z.object({ action: z.literal("document"), projectId: text, contractId: text.optional().or(z.literal("")), kind: z.enum(["CLAIM", "COST", "ADVANCE", "SETTLEMENT", "RETENTION_RELEASE"]), date: dateInput, reference: text, description: z.string().trim().min(1).max(3000), amount: positive, category: z.enum(["MATERIAL", "LABOUR", "EQUIPMENT", "OTHER"]).optional(), cashAccountId: text.optional().or(z.literal("")) }),
  z.object({ action: z.literal("approve"), documentId: text }),
  z.object({ action: z.literal("void"), documentId: text }),
  z.object({ action: z.literal("dailyLog"), projectId: text, date: dateInput, description: z.string().trim().min(1).max(5000), workersCount: z.coerce.number().int().min(0).max(100000), progressPercent: percent }),
]);
