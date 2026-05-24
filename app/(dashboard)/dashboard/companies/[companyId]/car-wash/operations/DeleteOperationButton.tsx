"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  operationId: string;
  locale: string;
}

export function DeleteOperationButton({ operationId, locale }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      locale === "en"
        ? "Delete this operation and cancel its linked accounting impact?"
        : "حذف هذه العملية وإلغاء آثارها المحاسبية المرتبطة؟",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/car-wash/operations/${operationId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? (locale === "en" ? "Delete failed" : "فشل في حذف العملية"));
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : locale === "en" ? "Delete failed" : "فشل في حذف العملية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      <Trash2 size={12} />
      {loading ? (locale === "en" ? "Deleting..." : "جارٍ الحذف...") : locale === "en" ? "Delete" : "حذف"}
    </button>
  );
}
