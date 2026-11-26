import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";
import { financeOutline, financePrimary } from "./workspace";

export function FinanceDateFilters({ search, clearHref }: { search: { month?: string; from?: string; to?: string }; clearHref: string }) {
  return <form className="rounded-xl border bg-card p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-2 text-sm font-bold"><Filter size={16} />تصفية النتائج</div>
    <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label><span className="form-label">الشهر</span><input className="input-field" name="month" type="month" defaultValue={search.month} /></label>
      <label><span className="form-label">من تاريخ</span><input className="input-field" name="from" type="date" defaultValue={search.from} /></label>
      <label><span className="form-label">إلى تاريخ</span><input className="input-field" name="to" type="date" defaultValue={search.to} /></label>
      <div className="flex flex-wrap gap-2"><button className={financePrimary}><Filter size={16} />تصفية</button><Link className={financeOutline} href={clearHref}><RotateCcw size={16} />مسح</Link></div>
    </div><p className="mt-3 text-xs text-muted-foreground">اختيار الشهر له الأولوية على نطاق التاريخ.</p>
  </form>;
}
