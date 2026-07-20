export const EMPLOYEE_TYPE_OPTIONS = {
  DELIVERY: [
    "DRIVER",
    "DELIVERY_DRIVER",
    "DELIVERY_ADMIN",
    "OFFICE_EMPLOYEE",
    "ACCOUNTANT",
    "MANDOUB",
    "OFFICE_BOY",
    "OTHER",
  ],
  CAR_WASH: [
    "CAR_WASH_DRIVER",
    "CAR_WASH_WORKER",
    "OFFICE_EMPLOYEE",
    "ACCOUNTANT",
    "OFFICE_BOY",
    "OTHER",
  ],
  DEFAULT: [
    "OFFICE_EMPLOYEE",
    "ACCOUNTANT",
    "MANDOUB",
    "OFFICE_BOY",
    "OTHER",
  ],
} as const;

export type EmployeeTypeOption = (typeof EMPLOYEE_TYPE_OPTIONS)[keyof typeof EMPLOYEE_TYPE_OPTIONS][number];

export function getAllowedEmployeeTypes(companyType: string): readonly EmployeeTypeOption[] {
  if (companyType === "DELIVERY") return EMPLOYEE_TYPE_OPTIONS.DELIVERY;
  if (companyType === "CAR_WASH") return EMPLOYEE_TYPE_OPTIONS.CAR_WASH;
  return EMPLOYEE_TYPE_OPTIONS.DEFAULT;
}

export function allowsCrossCompanyLicenses(companyType: string): boolean {
  return companyType !== "CAR_WASH";
}
