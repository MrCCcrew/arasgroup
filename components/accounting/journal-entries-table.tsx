"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Eye } from "lucide-react";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { formatDate, formatKWD } from "@/lib/utils";
import type { JournalStatus } from "@prisma/client";

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: Date;
  descriptionAr: string | null;
  type: string;
  totalDebit: any;
  totalCredit: any;
  status: JournalStatus;
  createdBy: { nameAr: string; nameEn: string | null } | null;
  _count: { lines: number };
}

interface Props {
  entries: JournalEntry[];
  companyId: string;
  locale: "ar" | "en";
  numberLocale: string;
  dateLocale: string;
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  canDelete: boolean;
}

const statusColors: Record<JournalStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  POSTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export function JournalEntriesTable({
  entries,
  companyId,
  locale,
  numberLocale,
  dateLocale,
  statusLabels,
  typeLabels,
  canDelete,
}: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const en = locale === "en";
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const someSelected = selectedIds.length > 0;

  // Only allow bulk operations on entries that can be approved/posted
  const eligibleEntries = entries.filter(
    (e) => e.status === "DRAFT" || e.status === "PENDING_APPROVAL" || e.status === "APPROVED"
  );
  const allEligibleSelected = eligibleEntries.length > 0 && eligibleEntries.every((e) => selectedIds.includes(e.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map((e) => e.id));
    }
  }

  function toggleEntry(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleBulkAction(action: "approve" | "post") {
    if (selectedIds.length === 0) return;

    const actionText = action === "approve" ? (en ? "approve" : "اعتماد") : (en ? "post" : "ترحيل");
    if (!confirm(`${en ? "Confirm" : "تأكيد"} ${actionText} ${selectedIds.length} ${en ? "entries?" : "قيد؟"}`)) {
      return;
    }

    setBulkLoading(true);
    setBulkError("");

    try {
      const res = await fetch(`/api/accounting/journal-entries/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          entryIds: selectedIds,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? (en ? "Operation failed" : "فشلت العملية"));
      }

      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : (en ? "An error occurred" : "حدث خطأ"));
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div>
      {/* Bulk Actions Toolbar */}
      {someSelected && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {en ? `${selectedIds.length} selected` : `${selectedIds.length} محدد`}
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {en ? "Clear selection" : "إلغاء التحديد"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("approve")}
              disabled={bulkLoading}
              className="flex items-center gap-2 rounded-lg border bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {bulkLoading ? (en ? "Processing..." : "جاري المعالجة...") : (en ? "Approve selected" : "اعتماد المحدد")}
            </button>
            <button
              onClick={() => handleBulkAction("post")}
              disabled={bulkLoading}
              className="flex items-center gap-2 rounded-lg border bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {bulkLoading ? (en ? "Processing..." : "جاري المعالجة...") : (en ? "Post selected" : "ترحيل المحدد")}
            </button>
          </div>
        </div>
      )}

      {bulkError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bulkError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th>{en ? "Entry #" : "رقم القيد"}</th>
                <th>{en ? "Date" : "التاريخ"}</th>
                <th>{en ? "Description" : "البيان"}</th>
                <th>{en ? "Type" : "النوع"}</th>
                <th>{en ? "Total debit" : "إجمالي المدين"}</th>
                <th>{en ? "Status" : "الحالة"}</th>
                <th>{en ? "By" : "بواسطة"}</th>
                <th>{en ? "Actions" : "إجراءات"}</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    {en ? "No journal entries" : "لا توجد قيود"}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/10">
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="font-mono text-sm">{entry.entryNumber}</td>
                    <td className="text-sm">{formatDate(new Date(entry.date), dateLocale)}</td>
                    <td className="max-w-xs truncate text-sm">{entry.descriptionAr ?? "—"}</td>
                    <td>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {typeLabels[entry.type] ?? entry.type}
                      </span>
                    </td>
                    <td className="number font-medium">{formatKWD(Number(entry.totalDebit), numberLocale)}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[entry.status]}`}>
                        {statusLabels[entry.status] ?? entry.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {entry.createdBy ? (en ? entry.createdBy.nameEn ?? entry.createdBy.nameAr : entry.createdBy.nameAr) : "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}`}
                          className="rounded p-1.5 text-primary hover:bg-primary/10"
                          title={en ? "View" : "عرض"}
                        >
                          <Eye size={14} />
                        </Link>
                        {canDelete && entry.status === "DRAFT" && (
                          <DeleteConfirmButton
                            apiUrl={`/api/accounting/journal-entries/${entry.id}`}
                            confirmMessage={`${en ? "Delete entry" : "حذف القيد"} ${entry.entryNumber}?`}
                            warningMessage={en ? "This will permanently delete the journal entry." : "سيتم حذف القيد نهائياً."}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
