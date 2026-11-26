import { z } from "zod";

export const salaryAdjustmentSchema = z.object({
  titleAr: z.string().trim().min(1, "اكتب نوع أو سبب البند").max(191),
  titleEn: z.string().trim().max(191).optional(),
  amount: z.number().finite().positive("مبلغ البند يجب أن يكون أكبر من صفر").multipleOf(0.001),
});

export const salaryAdjustmentItemsSchema = z.array(salaryAdjustmentSchema).max(100).optional();
export type SalaryAdjustment = z.infer<typeof salaryAdjustmentSchema>;
export type SalaryAdjustmentField = "companyAddition" | "companyDeduction" | "additionalEarnings" | "deductions";
export type SalaryAdjustmentDetails = Partial<Record<SalaryAdjustmentField, SalaryAdjustment[]>>;

export const salaryAdjustmentDetailsSchema = z.object({
  companyAddition: salaryAdjustmentItemsSchema,
  companyDeduction: salaryAdjustmentItemsSchema,
  additionalEarnings: salaryAdjustmentItemsSchema,
  deductions: salaryAdjustmentItemsSchema,
}).optional();

export function adjustmentTotal(items: SalaryAdjustment[]) {
  return items.reduce((total, item) => total + Math.round(item.amount * 1000), 0) / 1000;
}

interface StoredSalaryItem {
  employeeId: string | null;
  type: string;
  category: string;
  titleAr: string;
  titleEn?: string | null;
  amount: string | number;
}

export function restoreSalaryAdjustments(items: StoredSalaryItem[], employeeId: string, isDriver: boolean): SalaryAdjustmentDetails {
  const employeeItems = items.filter(item => item.employeeId === employeeId && item.type !== "EMPLOYEE_ADVANCE_DEDUCTION");
  const select = (predicate: (item: StoredSalaryItem) => boolean) => {
    const matches = employeeItems.filter(predicate);
    // Undefined preserves legacy aggregate amounts when no itemization was saved.
    return matches.length ? matches.map(item => ({
      titleAr: item.titleAr,
      titleEn: item.titleEn || undefined,
      amount: Number(item.amount),
    })) : undefined;
  };
  return {
    companyAddition: isDriver ? select(item => item.type === "COMPANY_ADDITION") : undefined,
    companyDeduction: isDriver ? select(item => item.type === "COMPANY_DEDUCTION") : undefined,
    additionalEarnings: select(item => isDriver
      ? item.type === "ADDITIONAL_EARNING"
      : item.category === "EARNING" && !["BASE_SALARY", "INCENTIVE"].includes(item.type)),
    deductions: select(item => isDriver ? item.type === "DEDUCTION" : item.category === "DEDUCTION"),
  };
}
