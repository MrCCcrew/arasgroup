"use client";

/**
 * DeleteButton — زرار حذف reusable يستخدم في أي صفحة
 *
 * الاستخدام:
 *   <DeleteButton apiUrl={`/api/hr/employees/${employee.id}`} />
 *
 * Props:
 *   apiUrl          — الـ endpoint اللي يُستدعى بـ DELETE
 *   confirmMessage  — رسالة التأكيد (اختياري)
 *   onSuccess       — callback بعد الحذف (اختياري، default = router.refresh)
 *   label           — نص الزرار بدل الأيقونة (اختياري)
 *   size            — حجم الأيقونة (default 14)
 *   iconOnly        — إظهار أيقونة فقط بدون نص (default true)
 *   variant         — "icon" | "button" (default "icon")
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Check } from "lucide-react";

interface Props {
  apiUrl: string;
  confirmMessage?: string;
  onSuccess?: () => void;
  label?: string;
  size?: number;
  variant?: "icon" | "button";
}

export function DeleteButton({
  apiUrl,
  confirmMessage,
  onSuccess,
  label,
  size = 14,
  variant = "icon",
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function doDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl, { method: "DELETE" });
      const d = await res.json();
      if (!d.success) throw new Error(d.error ?? "فشل الحذف");
      setConfirming(false);
      if (onSuccess) onSuccess();
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  /* ── حالة التأكيد ── */
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        {error && (
          <span className="max-w-[120px] truncate text-xs text-red-600" title={error}>
            {error}
          </span>
        )}
        <button
          onClick={doDelete}
          disabled={loading}
          title="تأكيد الحذف"
          className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Check size={11} />
          {loading ? "..." : "تأكيد"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(""); }}
          title="إلغاء"
          className="rounded border px-2 py-1 text-xs hover:bg-muted"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  /* ── الزرار العادي ── */
  if (variant === "button") {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        {label ?? "حذف"}
      </button>
    );
  }

  /* ── الأيقونة (default) ── */
  return (
    <button
      onClick={() => setConfirming(true)}
      title={label ?? "حذف"}
      className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      <Trash2 size={size} />
    </button>
  );
}
