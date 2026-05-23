import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { daysUntilExpiry, formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ type?: string; search?: string }>;
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

export default async function EmployeesPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      isDeleted: false,
      ...(query.type
        ? {
            type: query.type as
              | "DRIVER"
              | "DELIVERY_DRIVER"
              | "DELIVERY_ADMIN"
              | "CAR_WASH_DRIVER"
              | "CAR_WASH_WORKER"
              | "OFFICE_EMPLOYEE"
              | "ACCOUNTANT"
              | "MANDOUB"
              | "OFFICE_BOY"
              | "OTHER",
          }
        : {}),
      ...(query.search ? { nameAr: { contains: query.search } } : {}),
    },
    include: {
      branch: { select: { nameAr: true, nameEn: true } },
      driver: { select: { id: true, isRegisteredTalabat: true, isRegisteredRoPops: true, walletBalance: true } },
      carWashWorker: { select: { role: true } },
    },
    orderBy: [{ type: "asc" }, { nameAr: "asc" }],
  });

  const typeCounts = employees.reduce<Record<string, number>>((accumulator, employee) => {
    accumulator[employee.type] = (accumulator[employee.type] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div>
      <Header
        title={locale === "en" ? "Employees" : "الموظفون"}
        subtitle={`${employees.length} ${locale === "en" ? "active employee(s)" : "موظف نشط"}`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/hr/employees/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New employee" : "موظف جديد"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/employees`}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${!query.type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "All" : "الكل"} ({employees.length})
          </Link>
          {Object.entries(typeLabels[locale]).map(([type, label]) => {
            const count = typeCounts[type] ?? 0;
            if (count === 0) return null;
            return (
              <Link
                key={type}
                href={`/dashboard/companies/${companyId}/hr/employees?type=${type}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${query.type === type ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {label} ({count})
              </Link>
            );
          })}
        </div>

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
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No employees found" : "لا يوجد موظفون"}
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
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
                        className={`transition-colors hover:bg-muted/20 ${isExpiringSoon ? "bg-yellow-50/30" : ""}`}
                      >
                        <td>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{employee.nameAr}</p>
                              {employee.employeeNumber && (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                  {employee.employeeNumber}
                                </span>
                              )}
                            </div>
                            {employee.nameEn && <p className="text-xs text-muted-foreground">{employee.nameEn}</p>}
                          </div>
                        </td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {typeLabels[locale][employee.type]}
                          </span>
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
                              {isExpiringSoon && (
                                <AlertTriangle
                                  size={12}
                                  className={isExpired || (days !== null && days <= 30) ? "text-red-500" : "text-yellow-500"}
                                />
                              )}
                            </div>
                          ) : (
                            locale === "en" ? "Not set" : "غير محدد"
                          )}
                        </td>
                        <td className="text-sm">{branchName}</td>
                        <td>
                          <Link href={`/dashboard/companies/${companyId}/hr/employees/${employee.id}`} className="text-xs text-primary hover:underline">
                            {locale === "en" ? "View" : "عرض"}
                          </Link>
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
