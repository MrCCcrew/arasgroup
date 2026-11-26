"use client";
import { useEffect, useState } from "react";

export function useSalaryAdvances(companyId: string, year: number | string, month: number | string, batchId?: string) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setAmounts({});
    const query = new URLSearchParams({ companyId, year: String(year), month: String(month), ...(batchId ? { batchId } : {}) });
    fetch(`/api/hr/salaries/advance-deductions?${query}`, { signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر تحميل أقساط السلف");
      if (!controller.signal.aborted) setAmounts(payload.data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, year, month, batchId]);
  return { amounts, error, loading };
}
