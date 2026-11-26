import type { Prisma } from "@prisma/client";

export interface EmployeeListFilters {
  group?: string;
  status?: string;
  category?: string;
  type?: string;
  positionId?: string;
  search?: string;
  residencyLicenseId?: string;
  workPermitLicenseId?: string;
  mainLicenseId?: string;
  subLicenseId?: string;
  residentialAddress?: string;
}

const filterKeys: (keyof EmployeeListFilters)[] = [
  "group", "status", "category", "type", "positionId", "search",
  "residencyLicenseId", "workPermitLicenseId", "mainLicenseId", "subLicenseId", "residentialAddress",
];

export function employeeListParams(filters: EmployeeListFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params;
}

/**
 * A person is stored once, but can be sponsored by one company and work under
 * a license belonging to another company.  This scope lets both companies see
 * that same person without creating a second Employee record.
 */
export function employeeCompanyScope(companyId: string, branchIds: string[] = []): Prisma.EmployeeWhereInput {
  const companyScope: Prisma.EmployeeWhereInput = {
    OR: [
      { companyId },
      { license: { companyId } },
      { residencyLicense: { companyId } },
      { workPermitLicense: { companyId } },
      { licenseAssignments: { some: { license: { companyId } } } },
    ],
  };
  return branchIds.length
    ? { AND: [companyScope, { OR: [{ branchId: { in: branchIds } }, { branchId: null }] }] }
    : companyScope;
}

/** Shared by the list and print report so both return the same employees. */
export function employeeListWhere(companyId: string, query: EmployeeListFilters, branchIds: string[] = []): Prisma.EmployeeWhereInput {
  return {
    ...(query.status === "deleted" ? { isDeleted: true } : { isDeleted: false, isActive: query.status !== "inactive" }),
    AND: [
      employeeCompanyScope(companyId, branchIds),
      query.group === "investor" ? { investorId: { not: null } } : query.group === "company" ? { investorId: null } : {},
      query.category === "drivers"
        ? { type: { in: ["DRIVER", "DELIVERY_DRIVER", "CAR_WASH_DRIVER"] } }
        : query.category === "admins"
          ? { investorId: null, type: { in: ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB", "OFFICE_BOY", "OTHER"] } }
          : {},
      query.type ? { type: query.type as Prisma.EnumEmployeeTypeFilter["equals"] } : {},
      query.positionId ? { positionId: query.positionId } : {},
      query.residencyLicenseId ? { residencyLicenseId: query.residencyLicenseId } : {},
      query.workPermitLicenseId ? { workPermitLicenseId: query.workPermitLicenseId } : {},
      query.mainLicenseId ? { licenseId: query.mainLicenseId } : {},
      query.subLicenseId ? { licenseId: query.subLicenseId } : {},
      query.residentialAddress ? { residentialAddress: query.residentialAddress } : {},
      query.search ? { OR: [
        { employeeNumber: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { civilId: { contains: query.search } },
      ] } : {},
    ],
  };
}
