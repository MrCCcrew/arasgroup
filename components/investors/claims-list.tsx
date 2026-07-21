"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ClaimEditDeleteActions } from "@/components/investors/claim-edit-delete-actions";
import { ClaimStatusActions } from "@/components/investors/claim-status-actions";
import { formatDate, formatKWD } from "@/lib/utils";

const PAGE_SIZE = 10;

const statusLabels = {
  PENDING: { ar: "معلق", en: "Pending" },
  SENT_TO_ACCOUNTANT: { ar: "أُرسل للمحاسب", en: "Sent to accountant" },
  SENT_TO_INVESTOR: { ar: "أُرسل للمسؤول", en: "Sent to investor" },
  PARTIALLY_COLLECTED: { ar: "محصل جزئيًا", en: "Partially collected" },
  COLLECTED: { ar: "تم التحصيل", en: "Collected" },
  COMPLETED: { ar: "تم التنفيذ", en: "Completed" },
  PAID: { ar: "مدفوع", en: "Paid" },
  RENEWED: { ar: "تم التجديد", en: "Renewed" },
  OVERDUE: { ar: "متأخر", en: "Overdue" },
  SETTLED: { ar: "مسوى", en: "Settled" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
} as const;

const typeLabels = {
  LICENSE_RENEWAL: { ar: "تجديد رخصة", en: "License renewal" },
  RESIDENCY_RENEWAL: { ar: "تجديد إقامة", en: "Residency renewal" },
  RENT: { ar: "إيجار", en: "Rent" },
  SALARY_FUNDING: { ar: "تمويل رواتب", en: "Salary funding" },
  ADMIN_FEE: { ar: "رسوم إدارية", en: "Administrative fee" },
  FINE: { ar: "غرامة", en: "Fine" },
  OTHER: { ar: "أخرى", en: "Other" },
} as const;

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700", SENT_TO_ACCOUNTANT: "bg-blue-50 text-blue-700",
  SENT_TO_INVESTOR: "bg-indigo-50 text-indigo-700", PARTIALLY_COLLECTED: "bg-amber-50 text-amber-700",
  COLLECTED: "bg-teal-50 text-teal-700", COMPLETED: "bg-green-50 text-green-700",
  PAID: "bg-green-50 text-green-700", RENEWED: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-red-50 text-red-700", SETTLED: "bg-slate-50 text-slate-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

export type ClaimListItem = {
  id: string; status: string; type: string; description: string; notes: string | null;
  investorName: string; investorPhone: string | null; branchName: string; claimDate: string; dueDate: string | null;
  totalActual: number; totalCollected: number;
  lines: { id: string; descriptionAr: string; actualAmount: number; collectedAmount: number }[];
  beneficiaries: { id: string; name: string; isInvestor: boolean }[];
};

export function ClaimsList({ claims, locale, canCollect, canAdmin, initialStatus }: { claims: ClaimListItem[]; locale: "ar" | "en"; canCollect: boolean; canAdmin: boolean; initialStatus?: string }) {
  const en = locale === "en";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus && initialStatus in statusLabels ? initialStatus : "all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const numberLocale = en ? "en-US" : "ar-KW";

  const filteredClaims = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return claims.filter((claim) => {
      const matchesSearch = !term || [claim.investorName, claim.branchName, claim.description, claim.notes ?? "", claim.type, claim.status, ...claim.beneficiaries.map((b) => b.name)].join(" ").toLocaleLowerCase().includes(term);
      const matchesStatus = status === "all" || claim.status === status;
      const matchesType = type === "all" || claim.type === type;
      const claimDay = claim.claimDate.slice(0, 10);
      return matchesSearch && matchesStatus && matchesType && (!dateFrom || claimDay >= dateFrom) && (!dateTo || claimDay <= dateTo);
    });
  }, [claims, dateFrom, dateTo, search, status, type]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const pageClaims = filteredClaims.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  const resetFilters = () => { setSearch(""); setStatus("all"); setType("all"); setDateFrom(""); setDateTo(""); setPage(1); };

  return <>
    <div className="rounded-xl border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="relative md:col-span-2"><Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="input-field w-full pr-8 text-sm" placeholder={en ? "Search by official, branch, description..." : "بحث بالمسؤول أو الفرع أو البيان..."} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />{search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted" aria-label={en ? "Clear search" : "مسح البحث"}><X size={14} /></button>}</div>
        <select className="input-field text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">{en ? "All statuses" : "كل الحالات"}</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label[locale]}</option>)}</select>
        <select className="input-field text-sm" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="all">{en ? "All types" : "كل الأنواع"}</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label[locale]}</option>)}</select>
        <input type="date" className="input-field text-sm" aria-label={en ? "From claim date" : "من تاريخ المطالبة"} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input type="date" className="input-field text-sm" aria-label={en ? "To claim date" : "إلى تاريخ المطالبة"} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={resetFilters} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Clear filters" : "مسح الفلاتر"}</button><span className="text-sm text-muted-foreground">{filteredClaims.length} {en ? "result(s)" : "نتيجة"}</span></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="ar-table"><thead><tr><th>{en ? "Investor" : "المسؤول والمدير"}</th><th>{en ? "Type" : "النوع"}</th><th>{en ? "Branch" : "الفرع"}</th><th>{en ? "Claim date" : "تاريخ المطالبة"}</th><th>{en ? "Due date" : "تاريخ الاستحقاق"}</th><th>{en ? "Required" : "المبلغ المطلوب"}</th><th>{en ? "Collected" : "المحصل"}</th><th>{en ? "Status" : "الحالة"}</th><th>{en ? "Actions" : "الإجراءات"}</th></tr></thead><tbody>
      {pageClaims.length === 0 ? <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{en ? "No claims match the current filters" : "لا توجد مطالبات مطابقة للفلاتر الحالية"}</td></tr> : pageClaims.map((claim) => <tr key={claim.id} className="align-top hover:bg-muted/30"><td className="font-medium">{claim.investorName}</td><td><div className="space-y-1"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{typeLabels[claim.type as keyof typeof typeLabels]?.[locale] ?? claim.type}</span>{claim.beneficiaries.length > 0 && <div className="flex flex-wrap gap-1">{claim.beneficiaries.map((b) => <span key={b.id} className={`rounded-full px-1.5 py-0.5 text-xs ${b.isInvestor ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-700"}`}>{b.name}</span>)}</div>}</div></td><td className="text-sm text-muted-foreground">{claim.branchName}</td><td className="text-sm">{formatDate(claim.claimDate, numberLocale)}</td><td className="text-sm">{claim.dueDate ? formatDate(claim.dueDate, numberLocale) : "—"}</td><td className="number text-sm">{formatKWD(claim.totalActual, numberLocale)}</td><td className={`number text-sm font-bold ${claim.totalCollected > 0 ? "text-teal-700" : "text-muted-foreground"}`}>{claim.totalCollected > 0 ? formatKWD(claim.totalCollected, numberLocale) : "—"}</td><td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status] ?? "bg-muted text-muted-foreground"}`}>{statusLabels[claim.status as keyof typeof statusLabels]?.[locale] ?? claim.status}</span></td><td><div className="flex flex-col gap-1.5"><ClaimStatusActions claimId={claim.id} status={claim.status} canCollect={canCollect} canAdmin={canAdmin} investorPhone={claim.investorPhone} investorName={claim.investorName} claimType={claim.type} claimDescription={claim.description} claimLines={claim.lines} dueDate={claim.dueDate ? formatDate(claim.dueDate, numberLocale) : null} totalActual={claim.totalActual} /><ClaimEditDeleteActions claimId={claim.id} status={claim.status} descriptionAr={claim.description} type={claim.type} dueDate={claim.dueDate} notes={claim.notes} /></div></td></tr>)}
    </tbody></table></div></div>
    {filteredClaims.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"><p className="text-sm text-muted-foreground">{en ? `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredClaims.length)} of ${filteredClaims.length}` : `عرض ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredClaims.length)} من ${filteredClaims.length}`}</p><div className="flex items-center gap-2"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><ChevronRight size={14} />{en ? "Previous" : "السابق"}</button><span className="text-sm font-medium">{en ? `Page ${page} of ${totalPages}` : `صفحة ${page} من ${totalPages}`}</span><button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">{en ? "Next" : "التالي"}<ChevronLeft size={14} /></button></div></div>}
  </>;
}
