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
  };
  initialSearch: string;
  locale: "ar" | "en";
}

export function EmployeeQuickSearch({ companyId, printHref, currentFilters, initialSearch, locale }: Props) {
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
  };

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
