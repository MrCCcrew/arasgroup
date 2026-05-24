"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

type CalcType = "end-of-service" | "leave-pay";
type Status = "CALCULATED" | "ACCRUED" | "PAID";

interface Props {
  calcId: string;
  calcType: CalcType;
  status: Status;
  notes: string | null;
  paidDate: string | null;
}

const STATUS_OPTIONS: { value: Status; ar: string }[] = [
  { value: "CALCULATED", ar: "محسوب" },
  { value: "ACCRUED",    ar: "مستحق" },
  { value: "PAID",       ar: "مصروف" },
];

export function CalcRowActions({ calcId, calcType, status, notes, paidDate }: Props) {
  const router = useRouter();
  const apiBase = calcType === "end-of-service" ? "/api/hr/end-of-service" : "/api/hr/leave-pay";

  const [showEdit, setShowEdit]     = useState(false);
  const [editStatus, setEditStatus] = useState<Status>(status);
  const [editNotes, setEditNotes]   = useState(notes ?? "");
  const [editPaidDate, setEditPaidDate] = useState(paidDate ? new Date(paidDate).toISOString().slice(0, 10) : "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openEdit() {
    setEditStatus(status);
    setEditNotes(notes ?? "");
    setEditPaidDate(paidDate ? new Date(paidDate).toISOString().slice(0, 10) : "");
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit() {
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`${apiBase}/${calcId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes || null,
          paidDate: editPaidDate || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "فشل الحفظ");
      setShowEdit(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setEditSaving(false); }
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError("");
    try {
      const res = await fetch(`${apiBase}/${calcId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "فشل الحذف");
      setShowDelete(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setDeleting(false); }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button onClick={openEdit} title="تعديل الحالة"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil size={13} />
        </button>
        <button onClick={() => { setDeleteError(""); setShowDelete(true); }} title="حذف"
          className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !editSaving && setShowEdit(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">تعديل الحالة</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="form-label">الحالة</label>
                <select className="input-field w-full" value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Status)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.ar}</option>)}
                </select>
              </div>
              {editStatus === "PAID" && (
                <div>
                  <label className="form-label">تاريخ الصرف</label>
                  <input type="date" className="input-field w-full" value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)} />
                </div>
              )}
              <div>
                <label className="form-label">ملاحظات</label>
                <textarea className="input-field w-full" rows={2} value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              {editError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowEdit(false)} disabled={editSaving}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {editSaving ? "جاري الحفظ..." : "حفظ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleting && setShowDelete(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-red-600">حذف السجل</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">هل تريد حذف هذا السجل نهائياً؟</p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ سيتم إلغاء القيد المحاسبي المرتبط. السجلات المصروفة لا يمكن حذفها. يتطلب صلاحية المشرف العام.
              </p>
              {deleteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{deleteError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDelete(false)} disabled={deleting}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button onClick={confirmDelete} disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {deleting
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <Trash2 size={14} />}
                  {deleting ? "جاري الحذف..." : "حذف نهائي"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
