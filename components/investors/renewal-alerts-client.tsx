"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";

const PAGE_SIZE = 10;

export type RenewalAlertListItem = {
  key: string;
  entityType: "EMPLOYEE" | "LICENSE_DOC";
  name: string;
  branch: string | null;
  documentType: string;
  expiryDate: string;
  daysLeft: number;
  existingClaim: { id: string; status: string } | null;
  newClaimHref: string;
};

const claimStatusLabels: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: "معلق", en: "Pending" }, SENT_TO_ACCOUNTANT: { ar: "عند المحاسب", en: "With accountant" },
  SENT_TO_INVESTOR: { ar: "عند المسؤول", en: "With investor" }, PARTIALLY_COLLECTED: { ar: "محصل جزئيًا", en: "Partial" },
  COLLECTED: { ar: "تم التحصيل", en: "Collected" }, OVERDUE: { ar: "متأخر", en: "Overdue" },
};

export function RenewalAlertsClient({ alerts, locale }: { alerts: RenewalAlertListItem[]; locale: "ar" | "en" }) {
  const en = locale === "en";
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [status, setStatus] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const documentTypes = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.documentType))), [alerts]);
  const filteredAlerts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return alerts.filter((alert) => {
      const alertDay = alert.expiryDate.slice(0, 10);
      const alertStatus = alert.daysLeft < 0 ? "expired" : alert.daysLeft <= 30 ? "urgent" : alert.daysLeft <= 60 ? "warning" : "upcoming";
      return (!term || [alert.name, alert.branch ?? "", alert.documentType].join(" ").toLocaleLowerCase().includes(term))
        && (entityType === "all" || alert.entityType === entityType)
        && (status === "all" || alertStatus === status)
        && (documentType === "all" || alert.documentType === documentType)
        && (!dateFrom || alertDay >= dateFrom)
        && (!dateTo || alertDay <= dateTo);
    });
  }, [alerts, dateFrom, dateTo, documentType, entityType, search, status]);
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const pageAlerts = filteredAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  const reset = () => { setSearch(""); setEntityType("all"); setStatus("all"); setDocumentType("all"); setDateFrom(""); setDateTo(""); setPage(1); };
  const urgentCount = filteredAlerts.filter((alert) => alert.daysLeft <= 30 && !alert.existingClaim).length;

  return <div className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/60">
    <div className="flex items-center gap-3 border-b border-orange-200 bg-orange-100/60 px-4 py-3">
      <AlertTriangle size={16} className="shrink-0 text-orange-600" />
      <span className="text-sm font-bold text-orange-800">{en ? "Renewals needed" : "تجديدات مطلوبة"}</span>
      {urgentCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{urgentCount} {en ? "urgent" : "عاجل"}</span>}
      <span className="ms-auto text-xs text-orange-600">{filteredAlerts.length} {en ? "item(s)" : "عنصر"}</span>
    </div>

    <div className="border-b border-orange-200 bg-background/70 p-4">
      <div className="grid gap-3 md:grid-cols-7">
        <div className="relative md:col-span-2"><Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="input-field w-full pr-8 text-sm" placeholder={en ? "Search by name, branch, or document..." : "بحث بالاسم أو الفرع أو المستند..."} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />{search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"><X size={14} /></button>}</div>
        <select className="input-field text-sm" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}><option value="all">{en ? "All sections" : "كل الأقسام"}</option><option value="EMPLOYEE">{en ? "Employees" : "الموظفون"}</option><option value="LICENSE_DOC">{en ? "Licenses" : "التراخيص"}</option></select>
        <select className="input-field text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">{en ? "All statuses" : "كل الحالات"}</option><option value="expired">{en ? "Expired" : "منتهي"}</option><option value="urgent">{en ? "Within 30 days" : "خلال 30 يوم"}</option><option value="warning">{en ? "Within 60 days" : "خلال 60 يوم"}</option><option value="upcoming">{en ? "Upcoming" : "قادم"}</option></select>
        <select className="input-field text-sm" value={documentType} onChange={(e) => { setDocumentType(e.target.value); setPage(1); }}><option value="all">{en ? "All document types" : "كل أنواع المستندات"}</option>{documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <input type="date" className="input-field text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} aria-label={en ? "From expiry date" : "من تاريخ الانتهاء"} />
        <input type="date" className="input-field text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} aria-label={en ? "To expiry date" : "إلى تاريخ الانتهاء"} />
      </div>
      <div className="mt-3"><button onClick={reset} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Clear filters" : "مسح الفلاتر"}</button></div>
    </div>

    <div className="divide-y divide-orange-100">{pageAlerts.length === 0 ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">{en ? "No renewals match the current filters" : "لا توجد تجديدات مطابقة للفلاتر الحالية"}</div> : pageAlerts.map((alert) => {
      const expired = alert.daysLeft < 0; const urgent = !expired && alert.daysLeft <= 30; const warning = !expired && alert.daysLeft <= 60;
      const daysColor = expired ? "font-bold text-red-700" : urgent ? "font-bold text-orange-700" : warning ? "text-yellow-700" : "text-muted-foreground";
      return <div key={alert.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{alert.name}</span>{alert.branch && <span className="text-xs text-muted-foreground">— {alert.branch}</span>}<span className={`rounded-full px-2 py-0.5 text-xs ${alert.entityType === "LICENSE_DOC" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{alert.documentType}</span></div><div className="mt-0.5 flex items-center gap-3"><span className="text-xs text-muted-foreground">{en ? "Expires:" : "ينتهي:"} {new Date(alert.expiryDate).toLocaleDateString(en ? "en-US" : "ar-KW")}</span><span className={`text-xs ${daysColor}`}>{expired ? `${en ? "Expired" : "انتهى منذ"} ${Math.abs(alert.daysLeft)} ${en ? "days" : "يوم"}` : `${alert.daysLeft} ${en ? "day(s) left" : "يوم متبقي"}`}</span></div></div><div className="shrink-0">{alert.existingClaim ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{claimStatusLabels[alert.existingClaim.status]?.[locale] ?? alert.existingClaim.status}</span> : <Link href={alert.newClaimHref} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"><Plus size={12} />{en ? "Create claim" : "إنشاء مطالبة"}</Link>}</div></div>;
    })}</div>
    {filteredAlerts.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-200 bg-background/70 p-3"><p className="text-sm text-muted-foreground">{en ? `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredAlerts.length)} of ${filteredAlerts.length}` : `عرض ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredAlerts.length)} من ${filteredAlerts.length}`}</p><div className="flex items-center gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><ChevronRight size={14} />{en ? "Previous" : "السابق"}</button><span className="text-sm font-medium">{en ? `Page ${page} of ${totalPages}` : `صفحة ${page} من ${totalPages}`}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">{en ? "Next" : "التالي"}<ChevronLeft size={14} /></button></div></div>}
  </div>;
}
