"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Car, FileText, Printer, Search, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  applyAlertFilters,
  buildFilterQuery,
  buildStats,
  getExpiryTypeOptions,
  severityFromDays,
  type ExpiryAlertFilters,
  type ExpiryAlertItem,
} from "./shared";

function StatCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "red" | "orange" | "yellow" | "blue";
}) {
  const toneClasses = {
    red: "bg-red-50 text-red-500",
    orange: "bg-orange-50 text-orange-500",
    yellow: "bg-yellow-50 text-yellow-500",
    blue: "bg-blue-50 text-blue-500",
  }[tone];

  return (
    <div className="stat-card">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
        <AlertTriangle size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Badge({ days, en }: { days: number; en: boolean }) {
  const level = severityFromDays(days);
  const classes =
    level === "expired"
      ? "bg-red-100 text-red-700"
      : level === "critical"
        ? "bg-orange-100 text-orange-700"
        : level === "warning"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${classes}`}>
      {level === "expired" ? (en ? "Expired" : "منتهي") : en ? `${days} days` : `${days} يوم`}
    </span>
  );
}

export function ExpiryAlertsClient({
  alerts,
  companyId,
  numberLocale,
  locale,
}: {
  alerts: ExpiryAlertItem[];
  companyId: string;
  numberLocale: string;
  locale: "ar" | "en";
}) {
  const en = locale === "en";
  const t = {
    expiredNow: en ? "Expired now" : "منتهية الآن",
    in30: en ? "Within 30 days" : "خلال 30 يوم",
    in60: en ? "Within 60 days" : "خلال 60 يوم",
    in90: en ? "Within 90 days (licenses)" : "خلال 90 يوم للتراخيص",
    employees: en ? "Employees" : "الموظفون",
    vehicles: en ? "Vehicles" : "المركبات",
    licenses: en ? "Licenses" : "التراخيص",
    employeesDesc: en ? "Residency, passports, licenses, health & municipality cards, visas" : "إقامات وجوازات ورخص وكروت صحة وبطاقات بلدية وفيزا",
    vehiclesDesc: en ? "Insurance, registration, municipality & advertising cards, vehicle health licenses" : "تأمين وتسجيل وبطاقات بلدية وإعلان وتراخيص صحية للمركبات",
    licensesDesc: en ? "Commercial, fire, health, advertising, traffic, customs & import" : "تجارية وإطفاء وصحية وإعلانات ومرور وجمارك واستيراد",
    searchPlaceholder: en ? "Search by name, type or detail..." : "بحث بالاسم أو النوع أو التفصيل...",
    allCategories: en ? "All sections" : "كل الأقسام",
    allStatuses: en ? "All statuses" : "كل الحالات",
    expired: en ? "Expired" : "منتهي",
    allTypes: en ? "All expiry types" : "كل أنواع الانتهاء",
    dateFrom: en ? "From date" : "من تاريخ",
    dateTo: en ? "To date" : "إلى تاريخ",
    printPdf: en ? "Print PDF (filtered)" : "طباعة PDF حسب الفلتر",
    clear: en ? "Clear filters" : "مسح الفلاتر",
    result: en ? "result(s)" : "نتيجة",
    colSection: en ? "Section" : "القسم",
    colItem: en ? "Item" : "العنصر",
    colDetail: en ? "Detail" : "التفصيل",
    colLicense: en ? "License" : "الترخيص",
    colType: en ? "Expiry type" : "نوع الانتهاء",
    colDate: en ? "Expiry date" : "تاريخ الانتهاء",
    colStatus: en ? "Status" : "الحالة",
    colAction: en ? "Action" : "الإجراء",
    noResults: en ? "No results match the current filters" : "لا توجد نتائج مطابقة للفلاتر الحالية",
    updateData: en ? "Update data" : "تحديث البيانات",
  };
  const categoryLabel = (c: ExpiryAlertItem["category"]) =>
    c === "employee" ? t.employees : c === "vehicle" ? t.vehicles : t.licenses;

  const [filters, setFilters] = useState<ExpiryAlertFilters>({
    search: "",
    category: "all",
    status: "all",
    expiryType: "all",
    dateFrom: "",
    dateTo: "",
  });

  const expiryTypeOptions = useMemo(() => getExpiryTypeOptions(alerts), [alerts]);
  const filteredAlerts = useMemo(() => applyAlertFilters(alerts, filters), [alerts, filters]);
  const stats = useMemo(() => buildStats(filteredAlerts), [filteredAlerts]);
  const query = buildFilterQuery(filters);
  const printHref = `/dashboard/companies/${companyId}/hr/expiry-alerts/print${query ? `?${query}` : ""}`;

  return (
    <div className="page-container space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t.expiredNow} count={stats.expired} tone="red" />
        <StatCard label={t.in30} count={stats.in30} tone="orange" />
        <StatCard label={t.in60} count={stats.in60} tone="yellow" />
        <StatCard label={t.in90} count={stats.in90} tone="blue" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-bold">{t.employees}</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "employee").length}</p>
          <p className="text-xs text-muted-foreground">{t.employeesDesc}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Car size={18} className="text-blue-500" />
            <h2 className="font-bold">{t.vehicles}</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "vehicle").length}</p>
          <p className="text-xs text-muted-foreground">{t.vehiclesDesc}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            <h2 className="font-bold">{t.licenses}</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "license").length}</p>
          <p className="text-xs text-muted-foreground">{t.licensesDesc}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-7">
          <div className="relative md:col-span-2">
            <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field w-full pr-8 text-sm"
              placeholder={t.searchPlaceholder}
              value={filters.search}
              onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
            />
          </div>

          <select
            className="input-field text-sm"
            value={filters.category}
            onChange={(e) => setFilters((current) => ({ ...current, category: e.target.value as ExpiryAlertFilters["category"] }))}
          >
            <option value="all">{t.allCategories}</option>
            <option value="employee">{t.employees}</option>
            <option value="vehicle">{t.vehicles}</option>
            <option value="license">{t.licenses}</option>
          </select>

          <select
            className="input-field text-sm"
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value as ExpiryAlertFilters["status"] }))}
          >
            <option value="all">{t.allStatuses}</option>
            <option value="expired">{t.expired}</option>
            <option value="critical">{t.in30}</option>
            <option value="warning">{t.in60}</option>
            <option value="upcoming">{t.in90}</option>
          </select>

          <select
            className="input-field text-sm"
            value={filters.expiryType}
            onChange={(e) => setFilters((current) => ({ ...current, expiryType: e.target.value }))}
          >
            <option value="all">{t.allTypes}</option>
            {expiryTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="input-field text-sm"
            placeholder={t.dateFrom}
            value={filters.dateFrom}
            onChange={(e) => setFilters((current) => ({ ...current, dateFrom: e.target.value }))}
          />

          <input
            type="date"
            className="input-field text-sm"
            placeholder={t.dateTo}
            value={filters.dateTo}
            onChange={(e) => setFilters((current) => ({ ...current, dateTo: e.target.value }))}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={printHref}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Printer size={14} />
            {t.printPdf}
          </Link>
          <button
            onClick={() => setFilters({ search: "", category: "all", status: "all", expiryType: "all", dateFrom: "", dateTo: "" })}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            {t.clear}
          </button>
          <span className="text-sm text-muted-foreground">
            {filteredAlerts.length} {t.result}
          </span>
        </div>
      </div>

      <div className="section-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="ar-table text-sm">
            <thead>
              <tr>
                <th>{t.colSection}</th>
                <th>{t.colItem}</th>
                <th>{t.colDetail}</th>
                <th>{t.colLicense}</th>
                <th>{t.colType}</th>
                <th>{t.colDate}</th>
                <th>{t.colStatus}</th>
                <th>{t.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {t.noResults}
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-muted/20">
                    <td className="text-xs font-medium text-muted-foreground">
                      {categoryLabel(alert.category)}
                    </td>
                    <td className="font-medium">{alert.title}</td>
                    <td className="text-sm text-muted-foreground">{alert.subtitle}</td>
                    <td className="text-sm text-muted-foreground">{alert.licenseName || "—"}</td>
                    <td>{alert.expiryType}</td>
                    <td className="number">{formatDate(alert.expiryDate, numberLocale)}</td>
                    <td>
                      <Badge days={alert.daysLeft} en={en} />
                    </td>
                    <td>
                      <Link href={alert.href} className="text-primary hover:underline">
                        {t.updateData}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
