"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { companyAvatarClasses, companyTypeLabel } from "@/components/modern/company-meta";

export interface ModernCompanyRow {
  id: string;
  nameAr: string;
  type: string;
  logoUrl: string | null;
  isActive: boolean;
  branches: number;
  total: number;
  drivers: number;
  admins: number;
  investorEmployees: number;
  deleted: number;
}

export function CompanyAvatar({ company, size = 36 }: { company: Pick<ModernCompanyRow, "nameAr" | "type" | "logoUrl">; size?: number }) {
  if (company.logoUrl) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[#E4E8F0] bg-white" style={{ width: size, height: size }}>
        <Image src={company.logoUrl} alt={company.nameAr} width={size} height={size} className="h-full w-full object-contain p-0.5" unoptimized />
      </span>
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold ${companyAvatarClasses(company.type)}`} style={{ width: size, height: size }}>
      {(company.nameAr.replace(/^\s*(شركة|شركه)\s+/, "").trim() || company.nameAr).charAt(0)}
    </span>
  );
}

export function ModernCompanies({ companies, showDeleted }: { companies: ModernCompanyRow[]; showDeleted: boolean }) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [query, setQuery] = useState("");
  const maxTotal = Math.max(1, ...companies.map((c) => c.total));
  const shown = useMemo(() => {
    const q = query.trim();
    return q ? companies.filter((c) => c.nameAr.includes(q) || companyTypeLabel(c.type).includes(q)) : companies;
  }, [companies, query]);

  return (
    <section aria-label="الشركات" className="flex flex-col gap-4 rounded-[24px] border border-[#E4E8F0] bg-card p-5 md:p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">الشركات</h2>
          <p className="text-[13px] text-[#5B6577]">{companies.length} شركة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#E4E8F0] bg-white px-3">
            <Search size={15} className="text-[#5B6577]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن شركة" aria-label="ابحث عن شركة" className="w-40 border-0 bg-transparent text-sm outline-none" />
          </label>
          <div className="flex gap-1 rounded-[14px] bg-[#F1F4F9] p-1">
            {(["table", "cards"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`h-8 rounded-[10px] px-3.5 text-[13px] ${view === v ? "bg-white font-bold text-[#0F172A] shadow-sm" : "text-[#5B6577]"}`}>
                {v === "table" ? "جدول" : "بطاقات"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-start">الشركة</th>
                <th className="text-start">النشاط</th>
                <th className="text-start">الموظفون النشطون</th>
                <th className="text-start">الفروع</th>
                <th className="text-start">السائقون</th>
                <th className="text-start">الإداريون</th>
                <th className="text-start">موظفو المسؤولين</th>
                {showDeleted && <th className="text-start">المحذوفون</th>}
                <th className="text-start">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/companies/${c.id}`} className="flex min-w-0 items-center gap-2.5 font-bold text-[#0F172A] hover:text-[#3B5BDB]">
                      <CompanyAvatar company={c} />
                      <span className="max-w-[260px] truncate" title={c.nameAr}>{c.nameAr}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-[13px] text-[#5B6577]">{companyTypeLabel(c.type)}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className="min-w-8 font-extrabold">{c.total}</span>
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#EEF0F4]">
                        <span className="block h-full rounded-full bg-[#3B5BDB]" style={{ width: `${Math.round((c.total / maxTotal) * 100)}%` }} />
                      </span>
                    </span>
                  </td>
                  <td>{c.branches}</td>
                  <td>{c.drivers}</td>
                  <td>{c.admins}</td>
                  <td>{c.investorEmployees}</td>
                  {showDeleted && <td className={c.deleted > 0 ? "font-bold text-[#B42318]" : "text-[#94A3B8]"}>{c.deleted}</td>}
                  <td>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.isActive ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#FEF1EC] text-[#B42318]"}`}>{c.isActive ? "نشط" : "متوقف"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <Link key={c.id} href={`/dashboard/companies/${c.id}`} className="flex flex-col gap-3 rounded-[18px] border border-[#E4E8F0] p-4 hover:border-[#C7D2FE]">
              <span className="flex items-center gap-3">
                <CompanyAvatar company={c} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.nameAr}</span>
                  <span className="text-xs text-[#5B6577]">{companyTypeLabel(c.type)}</span>
                </span>
              </span>
              <span className="grid grid-cols-4 gap-2 text-center text-xs text-[#5B6577]">
                <span><b className="block text-base font-extrabold text-[#0F172A]">{c.total}</b>موظف</span>
                <span><b className="block text-base font-extrabold text-[#0F172A]">{c.drivers}</b>سائق</span>
                <span><b className="block text-base font-extrabold text-[#0F172A]">{c.admins}</b>إداري</span>
                <span><b className="block text-base font-extrabold text-[#0F172A]">{c.branches}</b>فرع</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
