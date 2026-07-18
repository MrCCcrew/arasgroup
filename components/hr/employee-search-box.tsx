"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface Props {
  companyId: string;
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

export function EmployeeSearchBox({ companyId, currentFilters, initialSearch, locale }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  function handleSearch(value: string) {
    const params = new URLSearchParams();
    if (currentFilters.group) params.set("group", currentFilters.group);
    if (currentFilters.status) params.set("status", currentFilters.status);
    if (currentFilters.category) params.set("category", currentFilters.category);
    if (currentFilters.type) params.set("type", currentFilters.type);
    if (currentFilters.positionId) params.set("positionId", currentFilters.positionId);
    if (value.trim()) params.set("search", value.trim());

    const query = params.toString();
    router.push(`/dashboard/companies/${companyId}/hr/employees${query ? `?${query}` : ""}`);
  }

  function handleClear() {
    setSearch("");
    handleSearch("");
  }

  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSearch(search);
          }
        }}
        placeholder={
          locale === "en"
            ? "Search by employee number, name, or civil ID..."
            : "بحث برقم الموظف، الاسم، أو الرقم المدني..."
        }
        className="w-full rounded-lg border bg-card px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
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
  );
}
