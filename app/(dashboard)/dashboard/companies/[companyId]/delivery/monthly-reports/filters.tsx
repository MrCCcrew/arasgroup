"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, FileText } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  companyId: string;
  locale: "ar" | "en";
  contracts: Array<{ id: string; nameAr: string; platform: string }>;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function MonthlyReportsFilters({ companyId, locale, contracts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [month, setMonth] = useState(searchParams.get("month") || "");
  const [year, setYear] = useState(searchParams.get("year") || "");
  const [contractId, setContractId] = useState(searchParams.get("contractId") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (contractId) params.set("contractId", contractId);
    if (status) params.set("status", status);

    router.push(`/dashboard/companies/${companyId}/delivery/monthly-reports?${params.toString()}`);
  };

  const clearFilters = () => {
    setMonth("");
    setYear("");
    setContractId("");
    setStatus("");
    router.push(`/dashboard/companies/${companyId}/delivery/monthly-reports`);
  };

  const printPDF = () => {
    window.print();
  };

  const hasActiveFilters = month || year || contractId || status;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {locale === "en" ? "Month" : "الشهر"}
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input-field w-full"
          >
            <option value="">{locale === "en" ? "All months" : "كل الشهور"}</option>
            {(locale === "en" ? MONTHS_EN : MONTHS_AR).map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {locale === "en" ? "Year" : "السنة"}
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input-field w-full"
          >
            <option value="">{locale === "en" ? "All years" : "كل السنوات"}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {locale === "en" ? "Platform" : "المنصة"}
          </label>
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="input-field w-full"
          >
            <option value="">{locale === "en" ? "All platforms" : "كل المنصات"}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr} ({c.platform})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {locale === "en" ? "Status" : "الحالة"}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field w-full"
          >
            <option value="">{locale === "en" ? "All statuses" : "كل الحالات"}</option>
            <option value="DRAFT">{locale === "en" ? "Draft" : "مسودة"}</option>
            <option value="SUBMITTED">{locale === "en" ? "Submitted" : "مقدم"}</option>
            <option value="POSTED">{locale === "en" ? "Posted" : "مرحل"}</option>
            <option value="RECONCILED">{locale === "en" ? "Reconciled" : "مسوى"}</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={applyFilters}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Filter size={16} />
            {locale === "en" ? "Filter" : "تصفية"}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Clear" : "مسح"}
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end print:hidden">
        <button
          onClick={printPDF}
          className="flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
        >
          <FileText size={16} />
          {locale === "en" ? "Print PDF" : "طباعة PDF"}
        </button>
      </div>
    </div>
  );
}
