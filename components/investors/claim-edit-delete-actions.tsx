"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface Props {
  claimId: string;
  status: string;
  descriptionAr: string;
  type: string;
  dueDate: string | null;
  notes: string | null;
}

const TYPE_OPTIONS = [
  { value: "LICENSE_RENEWAL", ar: "تجديد رخصة", en: "License renewal" },
  { value: "RESIDENCY_RENEWAL", ar: "تجديد إقامة", en: "Residency renewal" },
  { value: "RENT", ar: "إيجار", en: "Rent" },
  { value: "SALARY_FUNDING", ar: "تمويل رواتب", en: "Salary funding" },
  { value: "ADMIN_FEE", ar: "رسوم إدارية", en: "Administrative fee" },
  { value: "FINE", ar: "غرامة", en: "Fine" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
] as const;

const EDITABLE_STATUSES = new Set(["PENDING", "SENT_TO_ACCOUNTANT"]);

export function ClaimEditDeleteActions({ claimId, status, descriptionAr, type, dueDate, notes }: Props) {
  const router = useRouter();
  const { locale } = useLocale();

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    descriptionAr,
    type,
    dueDate: dueDate ? new Date(dueDate).toISOString().slice(0, 10) : "",
    notes: notes ?? "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openEdit() {
    setEditForm({
      descriptionAr,
      type,
      dueDate: dueDate ? new Date(dueDate).toISOString().slice(0, 10) : "",
      notes: notes ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editForm.descriptionAr.trim()) {
      setEditError(locale === "en" ? "Description is required" : "البيان مطلوب");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/investors/claims/${claimId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptionAr: editForm.descriptionAr,
          type: editForm.type,
          dueDate: editForm.dueDate || null,
          notes: editForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? (locale === "en" ? "Failed to save" : "فشل الحفظ"));
      setShowEdit(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/investors/claims/${claimId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? (locale === "en" ? "Failed to delete" : "فشل الحذف"));
      setShowDelete(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ");
    } finally {
      setDeleting(false);
    }
  }

  const canEdit = EDITABLE_STATUSES.has(status);
  const canDelete = true; // السماح بالحذف في كل الحالات

  return (
    <>
      <div className="flex items-center gap-1">
        {canEdit && (
          <button
            onClick={openEdit}
            title={locale === "en" ? "Edit" : "تعديل"}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil size={13} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => { setDeleteError(""); setShowDelete(true); }}
            title={locale === "en" ? "Delete" : "حذف"}
            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">{locale === "en" ? "Edit claim" : "تعديل المطالبة"}</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="form-label">{locale === "en" ? "Description *" : "البيان *"}</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={editForm.descriptionAr}
                  onChange={(e) => setEditForm((p) => ({ ...p, descriptionAr: e.target.value }))}
                  placeholder={locale === "en" ? "Claim description" : "وصف المطالبة"}
                />
              </div>
              <div>
                <label className="form-label">{locale === "en" ? "Type" : "النوع"}</label>
                <select
                  className="input-field w-full"
                  value={editForm.type}
                  onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {locale === "en" ? opt.en : opt.ar}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">{locale === "en" ? "Due date" : "تاريخ الاستحقاق"}</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                <textarea
                  className="input-field w-full"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              {editError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowEdit(false)} disabled={editSaving} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  {locale === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button onClick={saveEdit} disabled={editSaving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {editSaving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save" : "حفظ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-red-600">{locale === "en" ? "Delete claim" : "حذف المطالبة"}</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">
                {locale === "en"
                  ? "Are you sure you want to permanently delete this claim?"
                  : "هل تريد حذف هذه المطالبة نهائياً؟"}
              </p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️{" "}
                {locale === "en"
                  ? "Claims with payments cannot be deleted. Use Cancel instead. Super-admin privilege required."
                  : "لا يمكن حذف مطالبة لها مدفوعات — استخدم الإلغاء. يتطلب صلاحية المشرف العام."}
              </p>
              {deleteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{deleteError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDelete(false)} disabled={deleting} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  {locale === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {deleting
                    ? locale === "en" ? "Deleting..." : "جاري الحذف..."
                    : locale === "en" ? "Delete" : "حذف نهائي"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
