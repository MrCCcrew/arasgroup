"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Printer } from "lucide-react";
import Link from "next/link";
import { employeeListParams, type EmployeeListFilters } from "@/lib/hr/employee-list";
import { useDebounce } from "@/hooks/use-debounce";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Props {
  companyId: string;
  printHref: string;
  currentFilters: EmployeeListFilters;
  residences: string[];
  initialSearch: string;
  locale: "ar" | "en";
  residencyLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null; civilEntityNumber: string | null; mainLicenseId: string | null }[];
  workPermitLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null; civilEntityNumber: string | null; mainLicenseId: string | null }[];
  mainLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null; civilEntityNumber: string | null }[];
  subLicenses: { id: string; commercialNameAr: string; commercialNameEn: string | null; civilEntityNumber: string | null; mainLicenseId: string | null }[];
}

export function EmployeeQuickSearch({ companyId, printHref, currentFilters, residences, initialSearch, locale, residencyLicenses, workPermitLicenses, mainLicenses, subLicenses }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);

  // Filtered lists based on selections
  const [filteredResidencyLicenses, setFilteredResidencyLicenses] = useState(residencyLicenses);
  const [filteredWorkPermitLicenses, setFilteredWorkPermitLicenses] = useState(workPermitLicenses);
  const [filteredSubLicenses, setFilteredSubLicenses] = useState(subLicenses);

  // Filter licenses when main license is selected
  useEffect(() => {
    if (currentFilters.mainLicenseId) {
      setFilteredResidencyLicenses(residencyLicenses.filter(l => l.mainLicenseId === currentFilters.mainLicenseId));
      setFilteredWorkPermitLicenses(workPermitLicenses.filter(l => l.mainLicenseId === currentFilters.mainLicenseId));
      setFilteredSubLicenses(subLicenses.filter(l => l.mainLicenseId === currentFilters.mainLicenseId));
    } else {
      setFilteredResidencyLicenses(residencyLicenses);
      setFilteredWorkPermitLicenses(workPermitLicenses);
      setFilteredSubLicenses(subLicenses);
    }
  }, [currentFilters.mainLicenseId, residencyLicenses, workPermitLicenses, subLicenses]);

  // Convert licenses to options format
  const residencyLicenseOptions = useMemo(() =>
    filteredResidencyLicenses.map(l => ({
      value: l.id,
      label: `${locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}${l.civilEntityNumber ? ` - ${l.civilEntityNumber}` : ''}`
    })),
    [filteredResidencyLicenses, locale]
  );

  const workPermitLicenseOptions = useMemo(() =>
    filteredWorkPermitLicenses.map(l => ({
      value: l.id,
      label: `${locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}${l.civilEntityNumber ? ` - ${l.civilEntityNumber}` : ''}`
    })),
    [filteredWorkPermitLicenses, locale]
  );

  const mainLicenseOptions = useMemo(() =>
    mainLicenses.map(l => ({
      value: l.id,
      label: `${locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}${l.civilEntityNumber ? ` - ${l.civilEntityNumber}` : ''}`
    })),
    [mainLicenses, locale]
  );

  const subLicenseOptions = useMemo(() =>
    filteredSubLicenses.map(l => ({
      value: l.id,
      label: `${locale === "en" ? l.commercialNameEn || l.commercialNameAr : l.commercialNameAr}${l.civilEntityNumber ? ` - ${l.civilEntityNumber}` : ''}`
    })),
    [filteredSubLicenses, locale]
  );

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

  const updateFilter = useCallback((key: keyof EmployeeListFilters, value: string) => {
    const params = employeeListParams({ ...currentFilters, search: search.trim(), [key]: value });
    const query = params.toString();
    router.push(`/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`);
  }, [companyId, currentFilters, router, search]);

  const handleLicenseFilter = (type: "residency" | "workPermit" | "main" | "sub", value: string) => {
    const keys = { residency: "residencyLicenseId", workPermit: "workPermitLicenseId", main: "mainLicenseId", sub: "subLicenseId" } as const;
    updateFilter(keys[type], value);
  };

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const handleSearch = useCallback(
    (value: string) => {
      const params = employeeListParams({ ...currentFilters, search: value.trim() });

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

        <SearchableSelect
          label={en ? "Residence location" : "مكان السكن"}
          value={currentFilters.residentialAddress || ""}
          onChange={(value) => updateFilter("residentialAddress", value)}
          options={[...new Set([...residences, ...(currentFilters.residentialAddress ? [currentFilters.residentialAddress] : [])])].map(value => ({ value, label: value }))}
          placeholder={en ? "All residence locations" : "كل أماكن السكن"}
        />

        {(residencyLicenses.length > 0 || workPermitLicenses.length > 0 || mainLicenses.length > 0 || subLicenses.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-3 col-span-2">
              <SearchableSelect
                label={t.residencyLicense}
                value={currentFilters.residencyLicenseId || ""}
                onChange={(value) => handleLicenseFilter('residency', value)}
                options={residencyLicenseOptions}
                placeholder={t.allLicenses}
              />

              <SearchableSelect
                label={t.workPermitLicense}
                value={currentFilters.workPermitLicenseId || ""}
                onChange={(value) => handleLicenseFilter('workPermit', value)}
                options={workPermitLicenseOptions}
                placeholder={t.allLicenses}
              />
            </div>

            <SearchableSelect
              label={t.mainLicense}
              value={currentFilters.mainLicenseId || ""}
              onChange={(value) => handleLicenseFilter('main', value)}
              options={mainLicenseOptions}
              placeholder={t.allLicenses}
            />

            <SearchableSelect
              label={t.subLicense}
              value={currentFilters.subLicenseId || ""}
              onChange={(value) => handleLicenseFilter('sub', value)}
              options={subLicenseOptions}
              placeholder={t.allLicenses}
            />
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
