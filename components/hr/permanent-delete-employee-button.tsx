"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  employeeId: string;
  employeeName: string;
  label?: string;
}

export function PermanentDeleteEmployeeButton({ employeeId, employeeName, label = "حذف نهائي" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/hr/employees/${employeeId}/permanent`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error ?? "فشل في حذف الموظف");
      }
      router.refresh();
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-xs text-red-600">
          حذف {employeeName} نهائياً؟
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "..." : "نعم"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="rounded-lg border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          لا
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
    >
      {label}
    </button>
  );
}
