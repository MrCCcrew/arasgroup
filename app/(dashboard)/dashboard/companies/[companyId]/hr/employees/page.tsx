import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { daysUntilExpiry, formatDate, formatKWD } from "@/lib/utils";
import { DeleteButton } from "@/components/ui/delete-button";
import { RestoreEmployeeButton } from "@/components/hr/restore-employee-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    type?: string;
    positionId?: string;
    search?: string;
    group?: string;
    status?: string;
    category?: string;
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
  } = {},
) {
  const searchParams = new URLSearchParams();
  if (params.group) searchParams.set("group", params.group);
  if (params.type) searchParams.set("type", params.type);
  if (params.positionId) searchParams.set("positionId", params.positionId);
  if (params.status) searchParams.set("status", params.status);
  if (params.category) searchParams.set("category", params.category);
  if (params.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return `/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`;
}

export default async function EmployeesPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";
  const getTypeLabel = (type: EmployeeType) => typeLabels[locale][type];
  const showingDeleted = query.status === "deleted";

  const activeWhere = { companyId, isActive: true, isDeleted: false };
  const deletedWhere = { companyId, isDeleted: true };
  const baseWhere = showingDeleted ? deletedWhere : activeWhere;

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

  const [investorEmployeeCount, companyEmployeeCount, driverCount, adminCount, deletedCount, positions, employees] = await Promise.all([
    prisma.employee.count({ where: { ...activeWhere, investorId: { not: null } } }),
    prisma.employee.count({ where: { ...activeWhere, investorId: null } }),
    prisma.employee.count({ where: { ...activeWhere, type: { in: [...DRIVER_TYPES] } } }),
    prisma.employee.count({ where: { ...activeWhere, investorId: null, type: { in: [...ADMIN_TYPES] } } }),
    prisma.employee.count({ where: deletedWhere }),
    prisma.employeePosition.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        ...baseWhere,
        ...groupFilter,
        ...categoryFilter,
        ...typeFilter,
        ...positionFilter,
        ...(query.search ? { nameAr: { contains: query.search } } : {}),
      },
      include: {
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
        position: { select: { nameAr: true, nameEn: true } },
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
  const subtitle = showingDeleted
    ? `${deletedCount} ${locale === "en" ? "deleted employee(s)" : "موظف محذوف"}`
    : `${totalCount} ${locale === "en" ? "active employee(s)" : "موظف نشط"}`;
  const showInvestorColumn = (!query.group || query.group === "investor") && query.category !== "admins";
  const tableColSpan = showInvestorColumn ? (showingDeleted ? 10 : 9) : showingDeleted ? 9 : 8;

  return (
    <div>
      <Header
        title={locale === "en" ? "Employees" : "الموظفون"}
        subtitle={subtitle}
        companyId={companyId}
        actions={
          showingDeleted ? null : (
            <Link
              href={`/dashboard/companies/${companyId}/hr/employees/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New employee" : "موظف جديد"}
            </Link>
          )
        }
      />

      <div className="page-container space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildEmployeesHref(companyId)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${!showingDeleted && !query.group && !query.category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{locale === "en" ? "Position:" : "الوظيفة:"}</label>
            <select
              value={query.positionId || ""}
              onChange={(e) => {
                const positionId = e.target.value;
                window.location.href = buildEmployeesHref(companyId, {
                  group: query.group,
                  status: query.status,
                  category: query.category,
                  search: query.search,
                  type: query.type,
                  positionId: positionId || undefined,
                });
              }}
              className="input-field"
            >
              <option value="">{locale === "en" ? "All positions" : "كل الوظائف"}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "en" ? p.nameEn || p.nameAr : p.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Name" : "الاسم"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Nationality" : "الجنسية"}</th>
                  <th>{locale === "en" ? "Phone" : "الجوال"}</th>
                  <th>{locale === "en" ? "Salary" : "الراتب"}</th>
                  <th>{locale === "en" ? "Residency expiry" : "انتهاء الإقامة"}</th>
                  <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                  {showInvestorColumn ? <th>{locale === "en" ? "Investor" : "المسئول"}</th> : null}
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
                        <td>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{employee.nameAr}</p>
                              {employee.employeeNumber ? (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                  {employee.employeeNumber}
                                </span>
                              ) : null}
                            </div>
                            {employee.nameEn ? <p className="text-xs text-muted-foreground">{employee.nameEn}</p> : null}
                          </div>
                        </td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{getTypeLabel(employee.type)}</span>
                        </td>
                        <td className="text-sm">{employee.nationality ?? (locale === "en" ? "Not set" : "غير محدد")}</td>
                        <td className="number text-sm" dir="ltr">
                          {employee.phone ?? (locale === "en" ? "Not set" : "غير محدد")}
                        </td>
                        <td className="number text-sm">
                          {employee.baseSalary ? formatKWD(Number(employee.baseSalary), numberLocale) : locale === "en" ? "Not set" : "غير محدد"}
                        </td>
                        <td>
                          {employee.residencyExpiry ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs">{formatDate(employee.residencyExpiry, dateLocale)}</span>
                              {!showingDeleted && isExpiringSoon ? (
                                <AlertTriangle
                                  size={12}
                                  className={isExpired || (days !== null && days <= 30) ? "text-red-500" : "text-yellow-500"}
                                />
                              ) : null}
                            </div>
                          ) : (
                            locale === "en" ? "Not set" : "غير محدد"
                          )}
                        </td>
                        <td className="text-sm">{branchName}</td>
                        {showInvestorColumn ? (
                          <td className="text-sm">
                            {employee.investor ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                {locale === "en" ? employee.investor.nameEn ?? employee.investor.nameAr : employee.investor.nameAr}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                        {showingDeleted ? (
                          <td className="text-sm">{employee.deletedAt ? formatDate(employee.deletedAt, dateLocale) : "—"}</td>
                        ) : null}
                        <td>
                          {showingDeleted ? (
                            <RestoreEmployeeButton employeeId={employee.id} label={locale === "en" ? "Restore" : "استعادة"} />
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
