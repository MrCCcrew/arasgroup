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

function Badge({ days }: { days: number }) {
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
      {level === "expired" ? "منتهي" : `${days} يوم`}
    </span>
  );
}

export function ExpiryAlertsClient({
  alerts,
  companyId,
  numberLocale,
}: {
  alerts: ExpiryAlertItem[];
  companyId: string;
  numberLocale: string;
}) {
  const [filters, setFilters] = useState<ExpiryAlertFilters>({
    search: "",
    category: "all",
    status: "all",
    expiryType: "all",
  });

  const expiryTypeOptions = useMemo(() => getExpiryTypeOptions(alerts), [alerts]);
  const filteredAlerts = useMemo(() => applyAlertFilters(alerts, filters), [alerts, filters]);
  const stats = useMemo(() => buildStats(filteredAlerts), [filteredAlerts]);
  const query = buildFilterQuery(filters);
  const printHref = `/dashboard/companies/${companyId}/hr/expiry-alerts/print${query ? `?${query}` : ""}`;

  return (
    <div className="page-container space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="منتهية الآن" count={stats.expired} tone="red" />
        <StatCard label="خلال 30 يوم" count={stats.in30} tone="orange" />
        <StatCard label="خلال 60 يوم" count={stats.in60} tone="yellow" />
        <StatCard label="خلال 90 يوم للتراخيص" count={stats.in90} tone="blue" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-bold">الموظفون</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "employee").length}</p>
          <p className="text-xs text-muted-foreground">إقامات وجوازات ورخص وكروت صحة وبطاقات بلدية وفيزا</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Car size={18} className="text-blue-500" />
            <h2 className="font-bold">المركبات</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "vehicle").length}</p>
          <p className="text-xs text-muted-foreground">تأمين وتسجيل وبطاقات بلدية وإعلان وتراخيص صحية للمركبات</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            <h2 className="font-bold">التراخيص</h2>
          </div>
          <p className="text-2xl font-bold">{filteredAlerts.filter((alert) => alert.category === "license").length}</p>
          <p className="text-xs text-muted-foreground">تجارية وإطفاء وصحية وإعلانات ومرور وجمارك واستيراد</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field w-full pr-8 text-sm"
              placeholder="بحث بالاسم أو النوع أو التفصيل..."
              value={filters.search}
              onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
            />
          </div>

          <select
            className="input-field text-sm"
            value={filters.category}
            onChange={(e) => setFilters((current) => ({ ...current, category: e.target.value as ExpiryAlertFilters["category"] }))}
          >
            <option value="all">كل الأقسام</option>
            <option value="employee">الموظفون</option>
            <option value="vehicle">المركبات</option>
            <option value="license">التراخيص</option>
          </select>

          <select
            className="input-field text-sm"
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value as ExpiryAlertFilters["status"] }))}
          >
            <option value="all">كل الحالات</option>
            <option value="expired">منتهي</option>
            <option value="critical">خلال 30 يوم</option>
            <option value="warning">خلال 60 يوم</option>
            <option value="upcoming">خلال 90 يوم للتراخيص</option>
          </select>

          <select
            className="input-field text-sm"
            value={filters.expiryType}
            onChange={(e) => setFilters((current) => ({ ...current, expiryType: e.target.value }))}
          >
            <option value="all">كل أنواع الانتهاء</option>
            {expiryTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={printHref}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Printer size={14} />
            طباعة PDF حسب الفلتر
          </Link>
          <button
            onClick={() => setFilters({ search: "", category: "all", status: "all", expiryType: "all" })}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            مسح الفلاتر
          </button>
          <span className="text-sm text-muted-foreground">
            {filteredAlerts.length} نتيجة
          </span>
        </div>
      </div>

      <div className="section-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="ar-table text-sm">
            <thead>
              <tr>
                <th>القسم</th>
                <th>العنصر</th>
                <th>التفصيل</th>
                <th>نوع الانتهاء</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    لا توجد نتائج مطابقة للفلاتر الحالية
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-muted/20">
                    <td className="text-xs font-medium text-muted-foreground">
                      {alert.category === "employee" ? "الموظفون" : alert.category === "vehicle" ? "المركبات" : "التراخيص"}
                    </td>
                    <td className="font-medium">{alert.title}</td>
                    <td className="text-sm text-muted-foreground">{alert.subtitle}</td>
                    <td>{alert.expiryType}</td>
                    <td className="number">{formatDate(alert.expiryDate, numberLocale)}</td>
                    <td>
                      <Badge days={alert.daysLeft} />
                    </td>
                    <td>
                      <Link href={alert.href} className="text-primary hover:underline">
                        تحديث البيانات
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
