"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  employeeId: string;
  label?: string;
}

export function RestoreEmployeeButton({ employeeId, label = "استعادة" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRestore() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/hr/employees/${employeeId}/restore`, { method: "POST" });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error ?? "فشل في استعادة الموظف");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRestore}
        disabled={loading}
        className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
      >
        {loading ? "..." : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
