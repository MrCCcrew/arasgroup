"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  companyId: string;
  reportId: string;
  locale: "ar" | "en";
}

export function ReportRowActions({ companyId, reportId, locale }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const t = (ar: string, en: string) => (locale === "en" ? en : ar);

  async function doDelete() {
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/delivery/monthly-reports/${reportId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({ success: false }));
    setDeleting(false);
    if (!data.success) {
      setError(data.error ?? t("فشل في الحذف", "Delete failed"));
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/dashboard/companies/${companyId}/delivery/monthly-reports/${reportId}/edit`}
        className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
        title={t("تعديل", "Edit")}
      >
        <Pencil size={15} />
      </Link>
      <button
        onClick={() => setConfirming(true)}
        className="rounded p-1.5 text-red-500 hover:bg-red-50"
        title={t("حذف", "Delete")}
      >
        <Trash2 size={15} />
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">{t("حذف التقرير الشهري", "Delete monthly report")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "سيتم حذف التقرير وكل سطوره، وعكس خصومات المحافظ المرتبطة به. لا يمكن التراجع.",
                "The report and all its lines will be deleted and the linked wallet deductions reversed. This cannot be undone."
              )}
            </p>
            {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {t("إلغاء", "Cancel")}
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t("جاري الحذف...", "Deleting...") : t("حذف", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
