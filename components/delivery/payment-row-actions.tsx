"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

interface BankAccount { id: string; nameAr: string; bankName: string }

interface Props {
  paymentId: string;
  platform: string | null;
  month: number;
  year: number;
  grossAmount: string;
  walletDeductions: string;
  netReceived: string;
  receivedDate: string;
  bankAccountId: string | null;
  notes: string | null;
  bankAccounts: BankAccount[];
}

const PLATFORM_OPTIONS = [
  { value: "", label: "— بدون منصة —" },
  { value: "TALABAT", label: "طلبات" },
  { value: "RO_POPS", label: "رو بوبس" },
];

const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export function PaymentRowActions({ paymentId, platform, month, year, grossAmount, walletDeductions, netReceived, receivedDate, bankAccountId, notes, bankAccounts }: Props) {
  const router = useRouter();

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    platform: platform ?? "",
    month,
    year,
    grossAmount: Number(grossAmount).toFixed(3),
    walletDeductions: Number(walletDeductions).toFixed(3),
    netReceived: Number(netReceived).toFixed(3),
    receivedDate: new Date(receivedDate).toISOString().slice(0, 10),
    bankAccountId: bankAccountId ?? "",
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
      platform: platform ?? "",
      month,
      year,
      grossAmount: Number(grossAmount).toFixed(3),
      walletDeductions: Number(walletDeductions).toFixed(3),
      netReceived: Number(netReceived).toFixed(3),
      receivedDate: new Date(receivedDate).toISOString().slice(0, 10),
      bankAccountId: bankAccountId ?? "",
      notes: notes ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  function recalcNet(gross: string, wallet: string) {
    const g = parseFloat(gross) || 0;
    const w = parseFloat(wallet) || 0;
    return (g - w).toFixed(3);
  }

  async function saveEdit() {
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/delivery/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: editForm.platform || null,
          month: Number(editForm.month),
          year: Number(editForm.year),
          grossAmount: Number(editForm.grossAmount),
          walletDeductions: Number(editForm.walletDeductions),
          netReceived: Number(editForm.netReceived),
          receivedDate: editForm.receivedDate,
          bankAccountId: editForm.bankAccountId || null,
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
      const res = await fetch(`/api/delivery/payments/${paymentId}`, { method: "DELETE" });
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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

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
              <h2 className="font-semibold">تعديل الدفعة</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">المنصة</label>
                  <select className="input-field w-full" value={editForm.platform}
                    onChange={(e) => setEditForm((p) => ({ ...p, platform: e.target.value }))}>
                    {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">تاريخ الاستلام</label>
                  <input type="date" className="input-field w-full" value={editForm.receivedDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, receivedDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الشهر</label>
                  <select className="input-field w-full" value={editForm.month}
                    onChange={(e) => setEditForm((p) => ({ ...p, month: Number(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">السنة</label>
                  <select className="input-field w-full" value={editForm.year}
                    onChange={(e) => setEditForm((p) => ({ ...p, year: Number(e.target.value) }))}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">المبلغ الإجمالي (د.ك)</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.grossAmount}
                  onChange={(e) => {
                    const gross = e.target.value;
                    setEditForm((p) => ({ ...p, grossAmount: gross, netReceived: recalcNet(gross, p.walletDeductions) }));
                  }} />
              </div>
              <div>
                <label className="form-label">خصم المحفظة (د.ك)</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.walletDeductions}
                  onChange={(e) => {
                    const wallet = e.target.value;
                    setEditForm((p) => ({ ...p, walletDeductions: wallet, netReceived: recalcNet(p.grossAmount, wallet) }));
                  }} />
              </div>
              <div>
                <label className="form-label">صافي المستلم (د.ك)</label>
                <input type="number" step="0.001" className="input-field w-full font-bold" value={editForm.netReceived}
                  onChange={(e) => setEditForm((p) => ({ ...p, netReceived: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">الحساب البنكي</label>
                <select className="input-field w-full" value={editForm.bankAccountId}
                  onChange={(e) => setEditForm((p) => ({ ...p, bankAccountId: e.target.value }))}>
                  <option value="">— نقدي —</option>
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
              <h2 className="font-semibold text-red-600">حذف الدفعة</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">هل تريد حذف هذه الدفعة نهائياً؟</p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ سيتم إلغاء القيد المحاسبي المرتبط تلقائياً. يتطلب صلاحية المشرف العام.
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
