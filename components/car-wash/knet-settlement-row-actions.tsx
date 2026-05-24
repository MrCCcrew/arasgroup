"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

interface BankAccount { id: string; nameAr: string; bankName: string }

interface Props {
  settlementId: string;
  settlementDate: string;
  grossAmount: string;
  commission: string;
  netAmount: string;
  bankAccountId: string;
  notes: string | null;
  bankAccounts: BankAccount[];
}

export function KnetSettlementRowActions({
  settlementId, settlementDate, grossAmount, commission, netAmount,
  bankAccountId, notes, bankAccounts,
}: Props) {
  const router = useRouter();

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    settlementDate: new Date(settlementDate).toISOString().slice(0, 10),
    grossAmount: Number(grossAmount).toFixed(3),
    commission: Number(commission).toFixed(3),
    netAmount: Number(netAmount).toFixed(3),
    bankAccountId,
    notes: notes ?? "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openEdit() {
    setEditForm({
      settlementDate: new Date(settlementDate).toISOString().slice(0, 10),
      grossAmount: Number(grossAmount).toFixed(3),
      commission: Number(commission).toFixed(3),
      netAmount: Number(netAmount).toFixed(3),
      bankAccountId,
      notes: notes ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  function recalcNet(gross: string, comm: string) {
    return (Math.max(0, (parseFloat(gross) || 0) - (parseFloat(comm) || 0))).toFixed(3);
  }

  async function saveEdit() {
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/car-wash/knet-settlements/${settlementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementDate: editForm.settlementDate,
          grossAmount: Number(editForm.grossAmount),
          commission: Number(editForm.commission),
          netAmount: Number(editForm.netAmount),
          bankAccountId: editForm.bankAccountId,
          notes: editForm.notes || null,
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
      const res = await fetch(`/api/car-wash/knet-settlements/${settlementId}`, { method: "DELETE" });
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
          <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">تعديل تسوية KNET</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="form-label">تاريخ التسوية</label>
                <input type="date" className="input-field w-full" value={editForm.settlementDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, settlementDate: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">إجمالي KNET (د.ك)</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.grossAmount}
                  onChange={(e) => {
                    const g = e.target.value;
                    setEditForm((p) => ({ ...p, grossAmount: g, netAmount: recalcNet(g, p.commission) }));
                  }} />
              </div>
              <div>
                <label className="form-label">العمولة البنكية (د.ك)</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.commission}
                  onChange={(e) => {
                    const c = e.target.value;
                    setEditForm((p) => ({ ...p, commission: c, netAmount: recalcNet(p.grossAmount, c) }));
                  }} />
              </div>
              <div>
                <label className="form-label">صافي المحول (د.ك)</label>
                <input type="number" step="0.001" className="input-field w-full font-bold" value={editForm.netAmount}
                  onChange={(e) => setEditForm((p) => ({ ...p, netAmount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">الحساب البنكي</label>
                <select className="input-field w-full" value={editForm.bankAccountId}
                  onChange={(e) => setEditForm((p) => ({ ...p, bankAccountId: e.target.value }))}>
                  {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.nameAr} — {b.bankName}</option>)}
                </select>
              </div>
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
              <h2 className="font-semibold text-red-600">حذف التسوية</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">هل تريد حذف هذه التسوية نهائياً؟</p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ سيتم فك ربط معاملات KNET المرتبطة وإلغاء القيد المحاسبي. يتطلب صلاحية المشرف العام.
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
