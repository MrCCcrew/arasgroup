"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

interface Investor { id: string; nameAr: string }

interface Props {
  ticketId: string;
  type: string;
  destination: string | null;
  travelDate: string | null;
  returnDate: string | null;
  cost: string | null;
  paidBy: string | null;
  investorId: string | null;
  notes: string | null;
  investors: Investor[];
}

const TYPE_OPTIONS = [
  { value: "ANNUAL_LEAVE",  ar: "إجازة سنوية",  en: "Annual Leave" },
  { value: "EMERGENCY",     ar: "طارئ",          en: "Emergency" },
  { value: "RESIGNATION",   ar: "استقالة",       en: "Resignation" },
  { value: "END_OF_SERVICE",ar: "نهاية خدمة",   en: "End of Service" },
  { value: "OTHER",         ar: "أخرى",          en: "Other" },
] as const;

export function TicketRowActions({ ticketId, type, destination, travelDate, returnDate, cost, paidBy, investorId, notes, investors }: Props) {
  const router = useRouter();

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    type,
    destination: destination ?? "",
    travelDate: travelDate ? new Date(travelDate).toISOString().slice(0, 10) : "",
    returnDate: returnDate ? new Date(returnDate).toISOString().slice(0, 10) : "",
    cost: cost ? Number(cost).toFixed(3) : "",
    paidBy: paidBy ?? "",
    investorId: investorId ?? "",
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
      type,
      destination: destination ?? "",
      travelDate: travelDate ? new Date(travelDate).toISOString().slice(0, 10) : "",
      returnDate: returnDate ? new Date(returnDate).toISOString().slice(0, 10) : "",
      cost: cost ? Number(cost).toFixed(3) : "",
      paidBy: paidBy ?? "",
      investorId: investorId ?? "",
      notes: notes ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit() {
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/hr/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editForm.type,
          destination: editForm.destination || null,
          travelDate: editForm.travelDate || null,
          returnDate: editForm.returnDate || null,
          cost: editForm.cost ? Number(editForm.cost) : null,
          paidBy: editForm.paidBy || null,
          investorId: editForm.investorId || null,
          notes: editForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "فشل الحفظ");
      setShowEdit(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/hr/tickets/${ticketId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "فشل الحذف");
      setShowDelete(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button onClick={openEdit} title="تعديل"
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
          <div className="w-full max-w-md rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">تعديل تذكرة السفر</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="form-label">نوع التذكرة</label>
                <select className="input-field w-full" value={editForm.type}
                  onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.ar}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">الوجهة</label>
                <input type="text" className="input-field w-full" value={editForm.destination}
                  onChange={(e) => setEditForm((p) => ({ ...p, destination: e.target.value }))}
                  placeholder="مثال: القاهرة" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">تاريخ السفر</label>
                  <input type="date" className="input-field w-full" value={editForm.travelDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, travelDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">تاريخ العودة</label>
                  <input type="date" className="input-field w-full" value={editForm.returnDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, returnDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">التكلفة (د.ك)</label>
                  <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.cost}
                    onChange={(e) => setEditForm((p) => ({ ...p, cost: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">يدفعها</label>
                  <select className="input-field w-full" value={editForm.paidBy}
                    onChange={(e) => setEditForm((p) => ({ ...p, paidBy: e.target.value }))}>
                    <option value="">— غير محدد —</option>
                    <option value="COMPANY">الشركة</option>
                    <option value="INVESTOR">المسئول والمدير</option>
                  </select>
                </div>
              </div>
              {editForm.paidBy === "INVESTOR" && investors.length > 0 && (
                <div>
                  <label className="form-label">المسئول والمدير</label>
                  <select className="input-field w-full" value={editForm.investorId}
                    onChange={(e) => setEditForm((p) => ({ ...p, investorId: e.target.value }))}>
                    <option value="">— اختر المسئول —</option>
                    {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="form-label">ملاحظات</label>
                <textarea className="input-field w-full" rows={2} value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
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
              <h2 className="font-semibold text-red-600">حذف التذكرة</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">هل تريد حذف هذه التذكرة نهائياً؟</p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ يتطلب صلاحية المشرف العام. لا يمكن التراجع عن هذا الإجراء.
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
