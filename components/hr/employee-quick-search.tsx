"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Printer } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";

interface Props {
  companyId: string;
  printHref: string;
  currentFilters: {
    group?: string;
    status?: string;
    category?: string;
    type?: string;
    positionId?: string;
    residencyLicenseId?: string;
    workPermitLicenseId?: string;
    mainLicenseId?: string;
    subLicenseId?: string;
    search?: string;
  };
  initialSearch: string;
  locale: "ar" | "en";
  mainLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null }[];
  subLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null }[];
}

export function EmployeeQuickSearch({ companyId, printHref, currentFilters, initialSearch, locale, mainLicenses, subLicenses }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);

  const en = locale === "en";
  const t = {
    searchPlaceholder: en
      ? "Search by name, employee no. or civil ID..."
      : "بحث بالاسم أو رقم الموظف أو الرقم المدني...",
    clear: en ? "Clear" : "مسح",
    printPdf: en ? "Print PDF (filtered)" : "طباعة PDF حسب الفلتر",
    residencyLicense: en ? "Residency License" : "ترخيص الإقامة",
    workPermitLicense: en ? "Work Permit License" : "ترخيص العمل",
    mainLicense: en ? "Main License" : "الترخيص الرئيسي",
    subLicense: en ? "Sub License" : "الترخيص الفرعي",
    allLicenses: en ? "All" : "الكل",
  };

  const handleLicenseFilter = useCallback(
    (type: 'residency' | 'workPermit' | 'main' | 'sub', value: string) => {
      const params = new URLSearchParams();
      if (currentFilters.group) params.set("group", currentFilters.group);
      if (currentFilters.status) params.set("status", currentFilters.status);
      if (currentFilters.category) params.set("category", currentFilters.category);
      if (currentFilters.type) params.set("type", currentFilters.type);
      if (currentFilters.positionId) params.set("positionId", currentFilters.positionId);
      if (currentFilters.search) params.set("search", currentFilters.search);

      if (type === 'residency') {
        if (value) params.set("residencyLicenseId", value);
        if (currentFilters.workPermitLicenseId) params.set("workPermitLicenseId", currentFilters.workPermitLicenseId);
        if (currentFilters.mainLicenseId) params.set("mainLicenseId", currentFilters.mainLicenseId);
        if (currentFilters.subLicenseId) params.set("subLicenseId", currentFilters.subLicenseId);
      } else if (type === 'workPermit') {
        if (currentFilters.residencyLicenseId) params.set("residencyLicenseId", currentFilters.residencyLicenseId);
        if (value) params.set("workPermitLicenseId", value);
        if (currentFilters.mainLicenseId) params.set("mainLicenseId", currentFilters.mainLicenseId);
        if (currentFilters.subLicenseId) params.set("subLicenseId", currentFilters.subLicenseId);
      } else if (type === 'main') {
        if (currentFilters.residencyLicenseId) params.set("residencyLicenseId", currentFilters.residencyLicenseId);
        if (currentFilters.workPermitLicenseId) params.set("workPermitLicenseId", currentFilters.workPermitLicenseId);
        if (value) params.set("mainLicenseId", value);
        if (currentFilters.subLicenseId) params.set("subLicenseId", currentFilters.subLicenseId);
      } else {
        if (currentFilters.residencyLicenseId) params.set("residencyLicenseId", currentFilters.residencyLicenseId);
        if (currentFilters.workPermitLicenseId) params.set("workPermitLicenseId", currentFilters.workPermitLicenseId);
        if (currentFilters.mainLicenseId) params.set("mainLicenseId", currentFilters.mainLicenseId);
        if (value) params.set("subLicenseId", value);
      }

      const query = params.toString();
      router.push(`/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`);
    },
    [companyId, currentFilters, router]
  );

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (currentFilters.group) params.set("group", currentFilters.group);
      if (currentFilters.status) params.set("status", currentFilters.status);
      if (currentFilters.category) params.set("category", currentFilters.category);
      if (currentFilters.type) params.set("type", currentFilters.type);
      if (currentFilters.positionId) params.set("positionId", currentFilters.positionId);
      if (currentFilters.residencyLicenseId) params.set("residencyLicenseId", currentFilters.residencyLicenseId);
      if (currentFilters.workPermitLicenseId) params.set("workPermitLicenseId", currentFilters.workPermitLicenseId);
      if (currentFilters.mainLicenseId) params.set("mainLicenseId", currentFilters.mainLicenseId);
      if (value.trim()) params.set("search", value.trim());

      const query = params.toString();
      router.push(`/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`);
    },
    [companyId, currentFilters, router]
  );

  // Auto-search when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== initialSearch) {
      handleSearch(debouncedSearch);
    }
  }, [debouncedSearch, initialSearch, handleSearch]);

  function handleClear() {
    setSearch("");
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid gap-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-field w-full pr-8 text-sm"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={handleClear}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {(mainLicenses.length > 0 || subLicenses.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-3 col-span-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t.residencyLicense}</label>
                <select
                  className="input-field w-full text-sm"
                  value={currentFilters.residencyLicenseId || ""}
                  onChange={(e) => handleLicenseFilter('residency', e.target.value)}
                >
                  <option value="">{t.allLicenses}</option>
                  {mainLicenses.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{t.workPermitLicense}</label>
                <select
                  className="input-field w-full text-sm"
                  value={currentFilters.workPermitLicenseId || ""}
                  onChange={(e) => handleLicenseFilter('workPermit', e.target.value)}
                >
                  <option value="">{t.allLicenses}</option>
                  {mainLicenses.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.mainLicense}</label>
              <select
                className="input-field w-full text-sm"
                value={currentFilters.mainLicenseId || ""}
                onChange={(e) => handleLicenseFilter('main', e.target.value)}
              >
                <option value="">{t.allLicenses}</option>
                {mainLicenses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t.subLicense}</label>
              <select
                className="input-field w-full text-sm"
                value={currentFilters.subLicenseId || ""}
                onChange={(e) => handleLicenseFilter('sub', e.target.value)}
              >
                <option value="">{t.allLicenses}</option>
                {subLicenses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
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
        {search && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <X size={14} />
            {t.clear}
          </button>
        )}
      </div>
    </div>
  );
}
