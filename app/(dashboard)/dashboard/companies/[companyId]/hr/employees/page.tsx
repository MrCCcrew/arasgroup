import Link from "next/link";
import { AlertTriangle, Plus, Printer, Search, X } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { daysUntilExpiry, formatDate, formatDateShort, formatKWD } from "@/lib/utils";
import { DeleteButton } from "@/components/ui/delete-button";
import { RestoreEmployeeButton } from "@/components/hr/restore-employee-button";
import { PermanentDeleteEmployeeButton } from "@/components/hr/permanent-delete-employee-button";
import { EmployeeQuickSearch } from "@/components/hr/employee-quick-search";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    type?: string;
    positionId?: string;
    search?: string;
    group?: string;
    status?: string;
    category?: string;
    residencyLicenseId?: string;
    workPermitLicenseId?: string;
    mainLicenseId?: string;
    subLicenseId?: string;
  }>;
}

const typeLabels = {
  ar: {
    DRIVER: "سائق",
    DELIVERY_DRIVER: "سائق توصيل",
    DELIVERY_ADMIN: "إداري توصيل",
    CAR_WASH_DRIVER: "سائق غسيل",
    CAR_WASH_WORKER: "عامل غسيل",
    OFFICE_EMPLOYEE: "موظف مكتب",
    ACCOUNTANT: "محاسب",
    MANDOUB: "مندوب",
    OFFICE_BOY: "فراش",
    OTHER: "أخرى",
  },
  en: {
    DRIVER: "Driver",
    DELIVERY_DRIVER: "Delivery Driver",
    DELIVERY_ADMIN: "Delivery Admin",
    CAR_WASH_DRIVER: "Car Wash Driver",
    CAR_WASH_WORKER: "Car Wash Worker",
    OFFICE_EMPLOYEE: "Office Employee",
    ACCOUNTANT: "Accountant",
    MANDOUB: "Mandoub",
    OFFICE_BOY: "Office Boy",
    OTHER: "Other",
  },
} as const;

const DRIVER_TYPES = ["DRIVER", "DELIVERY_DRIVER", "CAR_WASH_DRIVER"] as const;
const ADMIN_TYPES = ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB", "OFFICE_BOY", "OTHER"] as const;

type EmployeeType = keyof typeof typeLabels.ar;

function buildEmployeesHref(
  companyId: string,
  params: {
    group?: string;
    type?: string;
    positionId?: string;
    status?: string;
    category?: string;
    search?: string;
    residencyLicenseId?: string;
    workPermitLicenseId?: string;
    mainLicenseId?: string;
    subLicenseId?: string;
  } = {},
) {
  const searchParams = new URLSearchParams();
  if (params.group) searchParams.set("group", params.group);
  if (params.type) searchParams.set("type", params.type);
  if (params.positionId) searchParams.set("positionId", params.positionId);
  if (params.status) searchParams.set("status", params.status);
  if (params.category) searchParams.set("category", params.category);
  if (params.search) searchParams.set("search", params.search);
  if (params.residencyLicenseId) searchParams.set("residencyLicenseId", params.residencyLicenseId);
  if (params.workPermitLicenseId) searchParams.set("workPermitLicenseId", params.workPermitLicenseId);
  if (params.mainLicenseId) searchParams.set("mainLicenseId", params.mainLicenseId);
  if (params.subLicenseId) searchParams.set("subLicenseId", params.subLicenseId);

  const query = searchParams.toString();
  return `/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`;
}

export default async function EmployeesPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = "en-US"; // Always use English numbers for salary
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";
  const getTypeLabel = (type: EmployeeType) => typeLabels[locale][type];
  const showingDeleted = query.status === "deleted";
  const showingInactive = query.status === "inactive";

  const activeWhere = { companyId, isActive: true, isDeleted: false };
  const inactiveWhere = { companyId, isActive: false, isDeleted: false };
  const deletedWhere = { companyId, isDeleted: true };
  const baseWhere = showingDeleted ? deletedWhere : showingInactive ? inactiveWhere : activeWhere;

  const categoryFilter =
    query.category === "drivers"
      ? { type: { in: [...DRIVER_TYPES] } }
      : query.category === "admins"
        ? { investorId: null, type: { in: [...ADMIN_TYPES] } }
        : {};

  const groupFilter =
    query.group === "investor"
      ? { investorId: { not: null } }
      : query.group === "company"
        ? { investorId: null }
        : {};

  const typeFilter = query.type
    ? {
        type: query.type as EmployeeType,
      }
    : {};

  const positionFilter = query.positionId
    ? {
        positionId: query.positionId,
      }
    : {};

  const residencyLicenseFilter = query.residencyLicenseId
    ? {
        residencyLicenseId: query.residencyLicenseId,
      }
    : {};

  const workPermitLicenseFilter = query.workPermitLicenseId
    ? {
        workPermitLicenseId: query.workPermitLicenseId,
      }
    : {};

  const mainLicenseFilter = query.mainLicenseId
    ? {
        licenseId: query.mainLicenseId,
      }
    : {};

  const subLicenseFilter = query.subLicenseId
    ? {
        licenseId: query.subLicenseId,
      }
    : {};

  // Get only licenses that are actually used by employees (separated by type)
  const [usedResidencyLicenseIds, usedWorkPermitLicenseIds, usedMainLicenseIds, usedSubLicenseIds] = await Promise.all([
    // Residency licenses
    prisma.employee.findMany({
      where: { ...activeWhere, residencyLicenseId: { not: null } },
      select: { residencyLicenseId: true },
      distinct: ['residencyLicenseId'],
    }).then(emps => emps.map(e => e.residencyLicenseId!)),
    // Work permit licenses
    prisma.employee.findMany({
      where: { ...activeWhere, workPermitLicenseId: { not: null } },
      select: { workPermitLicenseId: true },
      distinct: ['workPermitLicenseId'],
    }).then(emps => emps.map(e => e.workPermitLicenseId!)),
    // Main licenses (licenseId where license.isMainLicense = true)
    prisma.employee.findMany({
      where: { ...activeWhere, licenseId: { not: null }, license: { isMainLicense: true } },
      select: { licenseId: true },
      distinct: ['licenseId'],
    }).then(emps => emps.map(e => e.licenseId!)),
    // Sub licenses (licenseId where license.isMainLicense = false)
    prisma.employee.findMany({
      where: { ...activeWhere, licenseId: { not: null }, license: { isMainLicense: false } },
      select: { licenseId: true },
      distinct: ['licenseId'],
    }).then(emps => emps.map(e => e.licenseId!)),
  ]);

  const [investorEmployeeCount, companyEmployeeCount, driverCount, adminCount, inactiveCount, deletedCount, positions, residencyLicenses, workPermitLicenses, mainLicenses, subLicenses, employees] = await Promise.all([
    prisma.employee.count({ where: { ...activeWhere, investorId: { not: null } } }),
    prisma.employee.count({ where: { ...activeWhere, investorId: null } }),
    prisma.employee.count({ where: { ...activeWhere, type: { in: [...DRIVER_TYPES] } } }),
    prisma.employee.count({ where: { ...activeWhere, investorId: null, type: { in: [...ADMIN_TYPES] } } }),
    prisma.employee.count({ where: inactiveWhere }),
    prisma.employee.count({ where: deletedWhere }),
    prisma.employeePosition.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { sortOrder: "asc" },
    }),
    // Residency licenses
    prisma.license.findMany({
      where: { companyId, id: { in: usedResidencyLicenseIds } },
      select: { id: true, commercialNameAr: true, commercialNameEn: true, civilEntityNumber: true, mainLicenseId: true },
      orderBy: { commercialNameAr: "asc" },
    }),
    // Work permit licenses
    prisma.license.findMany({
      where: { companyId, id: { in: usedWorkPermitLicenseIds } },
      select: { id: true, commercialNameAr: true, commercialNameEn: true, civilEntityNumber: true, mainLicenseId: true },
      orderBy: { commercialNameAr: "asc" },
    }),
    // Main licenses
    prisma.license.findMany({
      where: { companyId, isMainLicense: true, id: { in: usedMainLicenseIds } },
      select: { id: true, commercialNameAr: true, commercialNameEn: true, civilEntityNumber: true },
      orderBy: { commercialNameAr: "asc" },
    }),
    // Sub licenses
    prisma.license.findMany({
      where: { companyId, isMainLicense: false, id: { in: usedSubLicenseIds } },
      select: { id: true, commercialNameAr: true, commercialNameEn: true, civilEntityNumber: true, mainLicenseId: true },
      orderBy: { commercialNameAr: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        ...baseWhere,
        ...groupFilter,
        ...categoryFilter,
        ...typeFilter,
        ...positionFilter,
        ...residencyLicenseFilter,
        ...workPermitLicenseFilter,
        ...mainLicenseFilter,
        ...subLicenseFilter,
        ...(query.search
          ? {
              OR: [
                { employeeNumber: { contains: query.search } },
                { nameAr: { contains: query.search } },
                { civilId: { contains: query.search } },
              ],
            }
          : {}),
      },
      include: {
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
        position: { select: { nameAr: true, nameEn: true } },
        license: {
          select: {
            commercialNameAr: true,
            commercialNameEn: true,
            managerName: true,
            isMainLicense: true,
            mainLicenseId: true,
            mainLicense: { select: { commercialNameAr: true, commercialNameEn: true, managerName: true } },
          },
        },
        residencyLicense: { select: { commercialNameAr: true, commercialNameEn: true } },
        workPermitLicense: { select: { commercialNameAr: true, commercialNameEn: true } },
        driver: { select: { id: true, isRegisteredTalabat: true, isRegisteredRoPops: true, walletBalance: true } },
        carWashWorker: { select: { role: true } },
      },
      orderBy: showingDeleted ? [{ deletedAt: "desc" }, { nameAr: "asc" }] : [{ type: "asc" }, { nameAr: "asc" }],
    }),
  ]);

  type EmployeeRow = typeof employees[number];
  const typeCounts = employees.reduce<Record<string, number>>((accumulator: Record<string, number>, employee: EmployeeRow) => {
    accumulator[employee.type] = (accumulator[employee.type] ?? 0) + 1;
    return accumulator;
  }, {});

  const totalCount = investorEmployeeCount + companyEmployeeCount;
  const inactiveSubtitle = `${inactiveCount} ${locale === "en" ? "inactive employee(s)" : "موظف غير نشط"}`;
  const subtitle = showingDeleted
    ? `${deletedCount} ${locale === "en" ? "deleted employee(s)" : "موظف محذوف"}`
    : `${totalCount} ${locale === "en" ? "active employee(s)" : "موظف نشط"}`;
  const showInvestorColumn = (!query.group || query.group === "investor") && query.category !== "admins";
  const tableColSpan = showInvestorColumn ? (showingDeleted ? 15 : 14) : showingDeleted ? 14 : 13;

  const printQuery = new URLSearchParams();
  if (query.type) printQuery.set("type", query.type);
  if (query.positionId) printQuery.set("positionId", query.positionId);
  if (query.search) printQuery.set("search", query.search);
  if (query.group) printQuery.set("group", query.group);
  if (query.status) printQuery.set("status", query.status);
  if (query.category) printQuery.set("category", query.category);
  const printHref = `/dashboard/companies/${companyId}/hr/employees/print${printQuery.toString() ? `?${printQuery.toString()}` : ""}`;

  return (
    <div>
      <Header
        title={locale === "en" ? "Employees" : "الموظفون"}
        subtitle={showingInactive ? inactiveSubtitle : subtitle}
        companyId={companyId}
        actions={
          showingDeleted ? null : (
            <div className="flex items-center gap-2">
              <Link
                href={printHref}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <Printer size={16} />
                {locale === "en" ? "Print report" : "طباعة التقرير"}
              </Link>
              <Link
                href={`/dashboard/companies/${companyId}/hr/employees/new`}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={16} />
                {locale === "en" ? "New employee" : "موظف جديد"}
              </Link>
            </div>
          )
        }
      />

      <div className="page-container space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildEmployeesHref(companyId)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && !showingInactive && !query.group && !query.category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "All active" : "كل النشطين"} ({totalCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { category: "drivers" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && query.category === "drivers" ? "bg-sky-600 text-white" : "border-sky-300 text-sky-700 hover:bg-sky-50"}`}
          >
            {locale === "en" ? "Drivers" : "السائقون"} ({driverCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { category: "admins" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && query.category === "admins" ? "bg-blue-600 text-white" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
          >
            {locale === "en" ? "Administrative" : "الإداريون"} ({adminCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { group: "investor" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && query.group === "investor" ? "bg-amber-600 text-white" : "border-amber-300 text-amber-700 hover:bg-amber-50"}`}
          >
            {locale === "en" ? "Investor employees" : "موظفو المسئولين"} ({investorEmployeeCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { group: "company" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && query.group === "company" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "Company employees" : "موظفو الشركة"} ({companyEmployeeCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { status: "inactive" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${showingInactive ? "bg-orange-600 text-white" : "border-orange-300 text-orange-700 hover:bg-orange-50"}`}
          >
            {locale === "en" ? "Inactive" : "غير النشطين"} ({inactiveCount})
          </Link>
          <Link
            href={buildEmployeesHref(companyId, { status: "deleted" })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${showingDeleted ? "bg-red-600 text-white" : "border-red-300 text-red-700 hover:bg-red-50"}`}
          >
            {locale === "en" ? "Deleted" : "المحذوفون"} ({deletedCount})
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={buildEmployeesHref(companyId, {
              group: query.group,
              status: query.status,
              category: query.category,
              search: query.search,
            })}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${!query.type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "All types" : "كل الأنواع"}
          </Link>
          {Object.entries(typeLabels[locale]).map(([type, label]: [string, string]) => {
            const count = typeCounts[type] ?? 0;
            if (count === 0) return null;

            return (
              <Link
                key={type}
                href={buildEmployeesHref(companyId, {
                  group: query.group,
                  status: query.status,
                  category: query.category,
                  search: query.search,
                  type,
                })}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${query.type === type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {label} ({count})
              </Link>
            );
          })}
        </div>

        {/* Position filter */}
        {positions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildEmployeesHref(companyId, {
                group: query.group,
                status: query.status,
                category: query.category,
                search: query.search,
                type: query.type,
                residencyLicenseId: query.residencyLicenseId,
                workPermitLicenseId: query.workPermitLicenseId,
                mainLicenseId: query.mainLicenseId,
                subLicenseId: query.subLicenseId,
              })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${!query.positionId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {locale === "en" ? "All positions" : "كل الوظائف"}
            </Link>
            {positions.map((p) => (
              <Link
                key={p.id}
                href={buildEmployeesHref(companyId, {
                  group: query.group,
                  status: query.status,
                  category: query.category,
                  search: query.search,
                  type: query.type,
                  positionId: p.id,
                  residencyLicenseId: query.residencyLicenseId,
                  workPermitLicenseId: query.workPermitLicenseId,
                  mainLicenseId: query.mainLicenseId,
                  subLicenseId: query.subLicenseId,
                })}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${query.positionId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {locale === "en" ? p.nameEn || p.nameAr : p.nameAr}
              </Link>
            ))}
          </div>
        )}

        <EmployeeQuickSearch
          companyId={companyId}
          printHref={printHref}
          currentFilters={{
            group: query.group,
            status: query.status,
            category: query.category,
            type: query.type,
            positionId: query.positionId,
            residencyLicenseId: query.residencyLicenseId,
            workPermitLicenseId: query.workPermitLicenseId,
            mainLicenseId: query.mainLicenseId,
            subLicenseId: query.subLicenseId,
            search: query.search,
          }}
          initialSearch={query.search || ""}
          locale={locale}
          residencyLicenses={residencyLicenses}
          workPermitLicenses={workPermitLicenses}
          mainLicenses={mainLicenses}
          subLicenses={subLicenses}
        />

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee No." : "رقم الموظف"}</th>
                  <th>{locale === "en" ? "Name" : "الاسم"}</th>
                  <th>{locale === "en" ? "Civil ID" : "الرقم المدني"}</th>
                  <th>{locale === "en" ? "Residency expiry" : "تاريخ انتهاء الإقامة"}</th>
                  <th>{locale === "en" ? "Position" : "الوظيفة"}</th>
                  <th>{locale === "en" ? "Salary (KD)" : "الراتب (د.ك)"}</th>
                  {showInvestorColumn ? <th>{locale === "en" ? "Investor" : "المسئول"}</th> : null}
                  <th>{locale === "en" ? "Residency license" : "ترخيص الإقامة"}</th>
                  <th>{locale === "en" ? "Work permit license" : "ترخيص العمل"}</th>
                  <th>{locale === "en" ? "Phone" : "التليفون"}</th>
                  <th>{locale === "en" ? "Main license" : "الترخيص الرئيسي"}</th>
                  <th>{locale === "en" ? "Sub license" : "الترخيص الفرعي"}</th>
                  <th>{locale === "en" ? "Authorized signer" : "المفوض بالتوقيع"}</th>
                  {showingDeleted ? <th>{locale === "en" ? "Deleted at" : "تاريخ الحذف"}</th> : null}
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No employees found" : "لا يوجد موظفون"}
                    </td>
                  </tr>
                ) : (
                  employees.map((employee: EmployeeRow) => {
                    const days = daysUntilExpiry(employee.residencyExpiry);
                    const isExpired = days !== null && days < 0;
                    const isExpiringSoon = days !== null && days <= 60;
                    const branchName = employee.branch
                      ? locale === "en"
                        ? employee.branch.nameEn ?? employee.branch.nameAr
                        : employee.branch.nameAr
                      : locale === "en"
                        ? "No branch"
                        : "بدون فرع";

                    return (
                      <tr
                        key={employee.id}
                        className={`transition-colors hover:bg-muted/20 ${!showingDeleted && isExpiringSoon ? "bg-yellow-50/30" : ""}`}
                      >
                        {/* 1. رقم الموظف */}
                        <td className="number text-sm">
                          {employee.employeeNumber ? (
                            <span className="font-mono">{employee.employeeNumber}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* 2. اسم الموظف */}
                        <td>
                          <div>
                            <p className="font-medium">{employee.nameAr}</p>
                            {employee.nameEn ? <p className="text-xs text-muted-foreground">{employee.nameEn}</p> : null}
                          </div>
                        </td>

                        {/* 3. الرقم المدني */}
                        <td className="number text-sm" dir="ltr">
                          {employee.civilId ?? (locale === "en" ? "Not set" : "غير محدد")}
                        </td>

                        {/* 4. تاريخ انتهاء الإقامة */}
                        <td className="text-sm">
                          {employee.residencyExpiry ? formatDateShort(employee.residencyExpiry, "en-US") : locale === "en" ? "Not set" : "غير محدد"}
                        </td>

                        {/* 5. الوظيفة */}
                        <td className="text-sm">
                          {employee.position
                            ? locale === "en"
                              ? employee.position.nameEn ?? employee.position.nameAr
                              : employee.position.nameAr
                            : locale === "en"
                              ? "Not set"
                              : "غير محدد"}
                        </td>

                        {/* 6. الراتب */}
                        <td className="number text-sm">
                          {employee.baseSalary ? formatKWD(Number(employee.baseSalary), numberLocale) : locale === "en" ? "Not set" : "غير محدد"}
                        </td>

                        {/* 7. المسؤول (conditional) */}
                        {showInvestorColumn ? (
                          <td className="text-sm">
                            {employee.investor ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                {locale === "en" ? employee.investor.nameEn ?? employee.investor.nameAr : employee.investor.nameAr}
                              </span>
                            ) : (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                                {locale === "en" ? "Company Administration" : "إدارة الشركة"}
                              </span>
                            )}
                          </td>
                        ) : null}

                        {/* 8. ترخيص الإقامة */}
                        <td className="text-sm">
                          {employee.residencyLicense
                            ? locale === "en"
                              ? employee.residencyLicense.commercialNameEn ?? employee.residencyLicense.commercialNameAr
                              : employee.residencyLicense.commercialNameAr
                            : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* 9. ترخيص العمل */}
                        <td className="text-sm">
                          {employee.workPermitLicense
                            ? locale === "en"
                              ? employee.workPermitLicense.commercialNameEn ?? employee.workPermitLicense.commercialNameAr
                              : employee.workPermitLicense.commercialNameAr
                            : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* 10. التليفون */}
                        <td className="number text-sm" dir="ltr">
                          {employee.phone ?? (locale === "en" ? "Not set" : "غير محدد")}
                        </td>

                        {/* 11. اسم الترخيص الرئيسي */}
                        <td className="text-sm">
                          {employee.license ? (
                            employee.license.isMainLicense ? (
                              locale === "en"
                                ? employee.license.commercialNameEn ?? employee.license.commercialNameAr
                                : employee.license.commercialNameAr
                            ) : employee.license.mainLicense ? (
                              locale === "en"
                                ? employee.license.mainLicense.commercialNameEn ?? employee.license.mainLicense.commercialNameAr
                                : employee.license.mainLicense.commercialNameAr
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* 12. اسم الترخيص الفرعي */}
                        <td className="text-sm">
                          {employee.license && !employee.license.isMainLicense
                            ? locale === "en"
                              ? employee.license.commercialNameEn ?? employee.license.commercialNameAr
                              : employee.license.commercialNameAr
                            : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* 13. المفوض بالتوقيع */}
                        <td className="text-sm">
                          {employee.license
                            ? employee.license.isMainLicense
                              ? employee.license.managerName ?? (locale === "en" ? "Not set" : "غير محدد")
                              : employee.license.mainLicense?.managerName ?? (locale === "en" ? "Not set" : "غير محدد")
                            : locale === "en"
                              ? "Not set"
                              : "غير محدد"}
                        </td>

                        {/* تاريخ الحذف (conditional) */}
                        {showingDeleted ? (
                          <td className="text-sm">{employee.deletedAt ? formatDateShort(employee.deletedAt, "en-US") : "—"}</td>
                        ) : null}

                        {/* الإجراءات */}
                        <td>
                          {showingDeleted ? (
                            <div className="flex items-center gap-2">
                              <RestoreEmployeeButton employeeId={employee.id} label={locale === "en" ? "Restore" : "استعادة"} />
                              <PermanentDeleteEmployeeButton
                                employeeId={employee.id}
                                employeeName={employee.nameAr}
                                label={locale === "en" ? "Delete permanently" : "حذف نهائي"}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/dashboard/companies/${companyId}/hr/employees/${employee.id}`}
                                className="rounded p-1.5 text-xs text-primary hover:underline"
                              >
                                {locale === "en" ? "View" : "عرض"}
                              </Link>
                              <Link
                                href={`/dashboard/companies/${companyId}/hr/employees/${employee.id}/edit`}
                                className="rounded p-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                              >
                                {locale === "en" ? "Edit" : "تعديل"}
                              </Link>
                              <DeleteButton apiUrl={`/api/hr/employees/${employee.id}`} label={locale === "en" ? "Delete" : "حذف"} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
