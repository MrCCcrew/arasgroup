"use client";

import { Filter, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export function CostCenterFilters({ companyId, defaultMonth, defaultYear, locale }: { companyId: string; defaultMonth: number; defaultYear: number; locale: "ar" | "en" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") ?? String(defaultMonth));
  const [year, setYear] = useState(searchParams.get("year") ?? String(defaultYear));
  const isEnglish = locale === "en";
  const apply = () => {
    const query = new URLSearchParams();
    if (month) query.set("month", month);
    if (year) query.set("year", year);
    router.push(`/dashboard/companies/${companyId}/delivery/cost-center?${query}`);
  };
  return <div className="section-card print:hidden"><div className="flex flex-wrap items-end gap-3">
    <div><label className="mb-1.5 block text-sm font-medium">{isEnglish ? "Month" : "الشهر"}</label><select value={month} onChange={(event) => setMonth(event.target.value)} className="input-field min-w-40"><option value="">{isEnglish ? "All months" : "كل الشهور"}</option>{MONTHS[locale].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
    <div><label className="mb-1.5 block text-sm font-medium">{isEnglish ? "Year" : "السنة"}</label><select value={year} onChange={(event) => setYear(event.target.value)} className="input-field min-w-32"><option value="">{isEnglish ? "All years" : "كل السنوات"}</option>{Array.from({ length: 5 }, (_, index) => defaultYear - index).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    <button type="button" onClick={apply} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Filter size={16} /> {isEnglish ? "Apply" : "تصفية"}</button>
    <button type="button" onClick={() => router.push(`/dashboard/companies/${companyId}/delivery/cost-center`)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"><RotateCcw size={16} /> {isEnglish ? "Reset" : "إعادة ضبط"}</button>
  </div></div>;
}
