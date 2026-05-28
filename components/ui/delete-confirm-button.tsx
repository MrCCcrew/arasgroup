"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

interface Props {
  apiUrl: string;
  confirmMessage?: string;
  warningMessage?: string;
  redirectUrl?: string;
  label?: string;
  size?: "sm" | "md";
}

export function DeleteConfirmButton({
  apiUrl,
  confirmMessage = "هل تريد حذف هذا السجل نهائياً؟",
  warningMessage,
  redirectUrl,
  label = "حذف",
  size = "sm",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "فشل الحذف");
      setOpen(false);
      if (redirectUrl) router.push(redirectUrl);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setError(""); setOpen(true); }}
        className={`inline-flex items-center gap-1 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors ${
          size === "sm" ? "p-1.5" : "gap-2 border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        }`}
        title={label}
      >
        <Trash2 size={size === "sm" ? 13 : 15} />
        {size === "md" && label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-red-600">تأكيد الحذف</h2>
              <button onClick={() => setOpen(false)} disabled={loading} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">{confirmMessage}</p>
              {warningMessage && (
                <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  ⚠️ {warningMessage}
                </p>
              )}
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setOpen(false)} disabled={loading} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loading
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <Trash2 size={14} />}
                  {loading ? "جارٍ الحذف..." : "حذف نهائي"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
