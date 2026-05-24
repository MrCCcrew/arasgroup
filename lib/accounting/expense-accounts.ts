export const EXPENSE_ACCOUNT_MAP: Record<string, string> = {
  SALARY: "5010",
  RENT: "5020",
  CAR_RENTAL: "5021",
  FUEL: "5030",
  VEHICLE_MAINTENANCE: "5031",
  CAR_INSTALLMENT: "5032",
  TRACKING: "5033",
  TELEPHONE: "5040",
  LABOR_INSURANCE: "5050",
  RESIDENCY_RENEWAL: "5060",
  LICENSE_RENEWAL: "5061",
  TRAVEL_TICKETS: "5070",
  TRAFFIC_VIOLATIONS: "5080",
  SERVER_SUBSCRIPTIONS: "5090",
  GARAGE_RENT: "5091",
  GENERAL: "5099",
};

export function resolveExpenseAccountCode(categoryType?: string | null, overrideCode?: string) {
  if (overrideCode) return overrideCode;
  if (categoryType && EXPENSE_ACCOUNT_MAP[categoryType]) return EXPENSE_ACCOUNT_MAP[categoryType];
  return EXPENSE_ACCOUNT_MAP.GENERAL;
}
