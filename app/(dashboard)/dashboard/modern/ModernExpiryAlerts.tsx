"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AlertItem, ExpiryAlertTotals } from "../ExpiryAlertsPanel";

const PAGE_SIZE = 10;

function dayBoxClasses(days: number) {
  if (days <= 30) return "bg-[#FEF1EC] text-[#B42318]";
  if (days <= 60) return "bg-[#FFF6E0] text-[#8A5A00]";
  return "bg-[#EAF3FF] text-[#1D5FA8]";
}

/** Same data, filters and paging as the classic panel — modern rows only. */
export function ModernExpiryAlerts({ alerts, totals }: { alerts: AlertItem[]; totals: ExpiryAlertTotals }) {
  const filterOptions = ["الكل", ...Array.from(new Set(alerts.map((item) => item.expiryLabel)))];
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [page, setPage] = useState(1);

  const filtered = activeFilter === "الكل" ? alerts : alerts.filter((item) => item.expiryLabel === activeFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section aria-label="تنبيهات الانتهاء" className="flex flex-col gap-4 rounded-[24px] border border-[#E4E8F0] bg-card p-5 md:p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">تنبيهات الانتهاء</h2>
          <p className="text-[13px] text-[#5B6577]">مرتبة حسب الأقرب انتهاءً · {filtered.length} نتيجة</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {totals.danger > 0 && <span className="rounded-full bg-[#FEF1EC] px-2.5 py-1 text-[#B42318]">{totals.danger} حرجة</span>}
          {totals.warning > 0 && <span className="rounded-full bg-[#FFF6E0] px-2.5 py-1 text-[#8A5A00]">{totals.warning} تحذير</span>}
          {totals.notice > 0 && <span className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[#1D5FA8]">{totals.notice} تنبيه</span>}
        </div>
      </div>

      <div role="tablist" aria-label="نوع المستند" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {filterOptions.map((option) => {
          const selected = option === activeFilter;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => { setActiveFilter(option); setPage(1); }}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] ${selected ? "border-[#0F172A] bg-[#0F172A] font-bold text-white" : "border-[#E4E8F0] bg-white text-[#334155]"}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {shown.map((item) => (
          <div key={item.key} className="flex items-center gap-3.5 border-t border-[#EEF0F4] px-1 py-3.5">
            <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl ${dayBoxClasses(item.daysLeft)}`}>
              <span className="text-xl font-extrabold leading-none">{item.daysLeft}</span>
              <span className="text-[11px] font-bold">يوم</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[15px] font-bold">{item.entityLabel}</span>
                <span className="rounded-full bg-[#F1F4F9] px-2.5 py-0.5 text-xs font-bold text-[#334155]">{item.expiryLabel}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#5B6577]">
                <span>{item.companyName}</span>
                {item.linkedLicense && <span>الترخيص: {item.linkedLicense}</span>}
                {item.responsibleName && <span>المسؤول: {item.responsibleName}</span>}
              </div>
            </div>
            <Link href={item.href} className="inline-flex h-10 shrink-0 items-center rounded-xl border border-[#E4E8F0] bg-white px-3.5 text-[13px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]">
              فتح
            </Link>
          </div>
        ))}
        {shown.length === 0 && <p className="border-t border-[#EEF0F4] py-8 text-center text-sm text-[#5B6577]">لا توجد تنبيهات في هذا التصنيف</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-[#5B6577]">
          <button type="button" aria-label="السابق" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E8F0] bg-white disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
          <span>صفحة {page} من {totalPages}</span>
          <button type="button" aria-label="التالي" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E8F0] bg-white disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
