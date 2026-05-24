"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

interface Category { id: string; nameAr: string }
interface BankAccount { id: string; nameAr: string; bankName: string }

interface Props {
  expenseId: string;
  date: string;
  amount: string;
  descriptionAr: string;
  categoryId: string;
  paymentMethod: string;
  bankAccountId: string | null;
  reference: string | null;
  categories: Category[];
  bankAccounts: BankAccount[];
}

const PAYMENT_METHODS = [
  { value: "CASH",          ar: "نقدي" },
  { value: "BANK_TRANSFER", ar: "تحويل بنكي" },
  { value: "CREDIT_CARD",   ar: "بطاقة ائتمان" },
  { value: "CHEQUE",        ar: "شيك" },
];

export function ExpenseRowActions({ expenseId, date, amount, descriptionAr, categoryId, paymentMethod, bankAccountId, reference, categories, bankAccounts }: Props) {
  const router = useRouter();

  const [showEdit, setShowEdit]   = useState(false);
  const [editForm, setEditForm]   = useState({
    date: new Date(date).toISOString().slice(0, 10),
    amount: Number(amount).toFixed(3),
    descriptionAr,
    categoryId,
    paymentMethod,
    bankAccountId: bankAccountId ?? "",
    reference: reference ?? "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openEdit() {
    setEditForm({
      date: new Date(date).toISOString().slice(0, 10),
      amount: Number(amount).toFixed(3),
      descriptionAr,
      categoryId,
      paymentMethod,
      bankAccountId: bankAccountId ?? "",
      reference: reference ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!editForm.descriptionAr.trim()) { setEditError("البيان مطلوب"); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError("أدخل مبلغاً صحيحاً"); return; }
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editForm.date,
          amount: Number(editForm.amount),
          descriptionAr: editForm.descriptionAr,
          categoryId: editForm.categoryId,
          paymentMethod: editForm.paymentMethod,
          bankAccountId: editForm.bankAccountId || null,
          reference: editForm.reference || null,
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
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "فشل الحذف");
      setShowDelete(false);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setDeleting(false); }
  }

  const needsBank = ["BANK_TRANSFER", "CREDIT_CARD", "CHEQUE"].includes(editForm.paymentMethod);

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
              <h2 className="font-semibold">تعديل المصروف</h2>
              <button onClick={() => setShowEdit(false)} disabled={editSaving}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">التاريخ *</label>
                  <input type="date" className="input-field w-full" value={editForm.date}
                    onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">المبلغ (د.ك) *</label>
                  <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.amount}
                    onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">البيان *</label>
                <input type="text" className="input-field w-full" value={editForm.descriptionAr}
                  onChange={(e) => setEditForm((p) => ({ ...p, descriptionAr: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">الفئة</label>
                <select className="input-field w-full" value={editForm.categoryId}
                  onChange={(e) => setEditForm((p) => ({ ...p, categoryId: e.target.value }))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">طريقة الدفع</label>
                  <select className="input-field w-full" value={editForm.paymentMethod}
                    onChange={(e) => setEditForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.ar}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">رقم المرجع</label>
                  <input type="text" className="input-field w-full" value={editForm.reference}
                    onChange={(e) => setEditForm((p) => ({ ...p, reference: e.target.value }))} />
                </div>
              </div>
              {needsBank && bankAccounts.length > 0 && (
                <div>
                  <label className="form-label">الحساب البنكي</label>
                  <select className="input-field w-full" value={editForm.bankAccountId}
                    onChange={(e) => setEditForm((p) => ({ ...p, bankAccountId: e.target.value }))}>
                    <option value="">— اختر الحساب —</option>
                    {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.nameAr} — {b.bankName}</option>)}
                  </select>
                </div>
              )}
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
              <h2 className="font-semibold text-red-600">حذف المصروف</h2>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">هل تريد حذف هذا المصروف نهائياً؟</p>
              <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⚠️ سيتم إلغاء القيد المحاسبي المرتبط. يتطلب صلاحية المشرف العام.
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
