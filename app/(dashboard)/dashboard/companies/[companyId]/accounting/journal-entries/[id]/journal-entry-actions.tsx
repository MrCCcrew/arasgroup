"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle, Trash2 } from "lucide-react";

interface Props {
  entryId: string;
  companyId: string;
  canPost: boolean;
  canApprove: boolean;
  canDelete: boolean;
  isLocked: boolean;
}

export function JournalEntryActions({ entryId, companyId, canPost, canApprove, canDelete, isLocked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function doAction(action: "post" | "approve" | "delete") {
    setError("");
    setLoading(action);
    try {
      if (action === "delete") {
        const res = await fetch(`/api/accounting/journal-entries/${entryId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "فشل في الحذف");
        router.push(`/dashboard/companies/${companyId}/accounting/journal-entries`);
        return;
      }

      const res = await fetch(`/api/accounting/journal-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في تنفيذ الإجراء");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  if (isLocked) {
    return <span className="text-xs text-muted-foreground border px-3 py-2 rounded-lg">السنة مقفلة</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}

      {canApprove && (
        <button
          onClick={() => doAction("approve")}
          disabled={loading !== null}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle size={15} />
          {loading === "approve" ? "جاري الاعتماد..." : "اعتماد"}
        </button>
      )}

      {canPost && (
        <button
          onClick={() => doAction("post")}
          disabled={loading !== null}
          className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <Send size={15} />
          {loading === "post" ? "جاري الترحيل..." : "ترحيل"}
        </button>
      )}

      {canDelete && (
        <button
          onClick={() => {
            if (confirm("هل تريد حذف هذا القيد؟")) doAction("delete");
          }}
          disabled={loading !== null}
          className="flex items-center gap-2 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 size={15} />
          {loading === "delete" ? "جاري الحذف..." : "حذف"}
        </button>
      )}
    </div>
  );
}
