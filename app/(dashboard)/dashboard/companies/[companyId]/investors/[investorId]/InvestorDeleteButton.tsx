"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

interface Props {
  investorId: string;
  companyId: string;
  investorName: string;
}

export function InvestorDeleteButton({ investorId, companyId, investorName }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/investors/${investorId}?companyId=${companyId}`,
        { method: "DELETE" }
      );
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error ?? "فشل الحذف");
      router.push(`/dashboard/companies/${companyId}/investors`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
      >
        <Trash2 size={15} />
        حذف
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-red-600">تأكيد الحذف</h2>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                هل تريد إيقاف المستثمر{" "}
                <span className="font-bold text-foreground">"{investorName}"</span>؟
              </p>
              <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                ⚠️ سيتم إيقاف المستثمر وإخفاؤه من القوائم. البيانات والمطالبات ستبقى محفوظة.
              </p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleting}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {deleting ? "جاري الحذف..." : "تأكيد الحذف"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
