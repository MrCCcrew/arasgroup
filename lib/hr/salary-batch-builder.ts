export interface SalaryPaymentDraftInput {
  employeeId: string;
  baseAmount: number;
  incentives: number;
  deductions: number;
  additionalEarnings: number;
  foodAllowance: number;
  companyAddition: number;
  fuelAddition: number;
  targetDeduction: number;
  companyDeduction: number;
  attendanceDays?: number;
  evaluationScore?: number;
  targetOrders?: number;
  actualOrders?: number;
  walletAmount?: number;
  amountDeliveredByDriver?: number;
  notes?: string;
}

const AR = {
  baseSalary: "\u0631\u0627\u062a\u0628 \u0623\u0633\u0627\u0633\u064a",
  incentive: "\u062d\u0627\u0641\u0632",
  foodAllowance: "\u0628\u062f\u0644 \u0637\u0639\u0627\u0645",
  companyAddition: "\u0625\u0636\u0627\u0641\u0629 \u0634\u0631\u0643\u0629",
  fuelAddition: "\u0625\u0636\u0627\u0641\u0629 \u0628\u0646\u0632\u064a\u0646 \u0648\u0628\u0646\u0634\u0631",
  otherAddition: "\u0625\u0636\u0627\u0641\u0629 \u0623\u062e\u0631\u0649",
  targetDeduction: "\u062e\u0635\u0645 \u062a\u0627\u0631\u062c\u064a\u062a",
  companyDeduction: "\u062e\u0635\u0645 \u0634\u0631\u0643\u0629",
  deduction: "\u062e\u0635\u0645",
};

export function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildSalaryBatchDraft(paymentsInput: SalaryPaymentDraftInput[]) {
  const payments = paymentsInput.map((payment) => {
    const additionalEarningsRaw = payment.additionalEarnings;
    const deductionsRaw = payment.deductions;
    const additionalEarnings = round3(
      additionalEarningsRaw + payment.foodAllowance + payment.companyAddition + payment.fuelAddition,
    );
    const deductions = round3(deductionsRaw + payment.targetDeduction + payment.companyDeduction);
    const netAmount = round3(payment.baseAmount + payment.incentives + additionalEarnings - deductions);

    return {
      ...payment,
      additionalEarnings,
      deductions,
      netAmount,
      additionalEarningsRaw,
      deductionsRaw,
    };
  });

  const totalGross = round3(
    payments.reduce(
      (sum, payment) => sum + payment.baseAmount + payment.incentives + payment.additionalEarnings,
      0,
    ),
  );
  const totalNet = round3(payments.reduce((sum, payment) => sum + payment.netAmount, 0));

  const items = payments.flatMap((payment) => {
    const result: Array<{
      employeeId: string;
      type: string;
      category: string;
      titleAr: string;
      titleEn: string;
      amount: number;
    }> = [
      {
        employeeId: payment.employeeId,
        type: "BASE_SALARY",
        category: "EARNING",
        titleAr: AR.baseSalary,
        titleEn: "Base Salary",
        amount: payment.baseAmount,
      },
    ];

    const add = (
      condition: boolean,
      type: string,
      category: string,
      titleAr: string,
      titleEn: string,
      amount: number,
    ) => {
      if (condition && amount > 0) {
        result.push({ employeeId: payment.employeeId, type, category, titleAr, titleEn, amount });
      }
    };

    add(true, "INCENTIVE", "EARNING", AR.incentive, "Incentive", payment.incentives);
    add(true, "FOOD_ALLOWANCE", "EARNING", AR.foodAllowance, "Food Allowance", payment.foodAllowance);
    add(true, "COMPANY_ADDITION", "EARNING", AR.companyAddition, "Company Addition", payment.companyAddition);
    add(true, "FUEL_ADDITION", "EARNING", AR.fuelAddition, "Fuel & Tire Addition", payment.fuelAddition);
    add(true, "ADDITIONAL_EARNING", "EARNING", AR.otherAddition, "Additional Earning", payment.additionalEarningsRaw);
    add(true, "TARGET_DEDUCTION", "DEDUCTION", AR.targetDeduction, "Target Deduction", payment.targetDeduction);
    add(true, "COMPANY_DEDUCTION", "DEDUCTION", AR.companyDeduction, "Company Deduction", payment.companyDeduction);
    add(true, "DEDUCTION", "DEDUCTION", AR.deduction, "Deduction", payment.deductionsRaw);

    return result;
  });

  return { payments, items, totalGross, totalNet };
}
