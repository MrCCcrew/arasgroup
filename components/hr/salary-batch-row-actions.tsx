"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";

interface Props {
  companyId: string;
  batchId: string;
  locale: "ar" | "en";
  canMutate: boolean;
}

const ar = {
  confirmDelete: "\u062d\u0630\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0642\u0628\u0644 \u0627\u0644\u062a\u0631\u062d\u064a\u0644\u061f",
  deleteFailed: "\u0641\u0634\u0644 \u062d\u0630\u0641 \u0627\u0644\u062f\u0641\u0639\u0629",
  view: "\u0639\u0631\u0636",
  edit: "\u062a\u0639\u062f\u064a\u0644",
  delete: "\u062d\u0630\u0641",
};

export function SalaryBatchRowActions({ companyId, batchId, locale, canMutate }: Props) {
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(
      locale === "en" ? "Delete this salary batch before posting?" : ar.confirmDelete,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/hr/salaries/${batchId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!payload.success) {
      window.alert(payload.error ?? (locale === "en" ? "Delete failed" : ar.deleteFailed));
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Link
        href={`/dashboard/companies/${companyId}/hr/salaries/${batchId}`}
        className="flex items-center gap-1 text-primary hover:underline"
      >
        <Eye size={12} />
        {locale === "en" ? "View" : ar.view}
      </Link>
      {canMutate && (
        <>
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries/${batchId}/edit`}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Pencil size={12} />
            {locale === "en" ? "Edit" : ar.edit}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1 text-red-600 hover:underline"
          >
            <Trash2 size={12} />
            {locale === "en" ? "Delete" : ar.delete}
          </button>
        </>
      )}
    </div>
  );
}
