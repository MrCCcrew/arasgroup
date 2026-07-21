"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw } from "lucide-react";
import { useState } from "react";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function CostCenterFilters({ companyId, defaultMonth, defaultYear }: { companyId: string; defaultMonth: number; defaultYear: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") ?? String(defaultMonth));
  const [year, setYear] = useState(searchParams.get("year") ?? String(defaultYear));
  const years = Array.from({ length: 5 }, (_, index) => defaultYear - index);
  const apply = () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    router.push(`/dashboard/companies/${companyId}/delivery/cost-center?${params.toString()}`);
  };

  return <div className="section-card print:hidden"><div className="flex flex-wrap items-end gap-3">
    <div><label className="mb-1.5 block text-sm font-medium">الشهر</label><select value={month} onChange={(event) => setMonth(event.target.value)} className="input-field min-w-40"><option value="">كل الشهور</option>{MONTHS_AR.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
    <div><label className="mb-1.5 block text-sm font-medium">السنة</label><select value={year} onChange={(event) => setYear(event.target.value)} className="input-field min-w-32"><option value="">كل السنوات</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    <button type="button" onClick={apply} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Filter size={16} /> تصفية</button>
    <button type="button" onClick={() => router.push(`/dashboard/companies/${companyId}/delivery/cost-center`)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"><RotateCcw size={16} /> إعادة ضبط</button>
  </div></div>;
}
