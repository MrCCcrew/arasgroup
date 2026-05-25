"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, Pencil, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Investor { id: string; nameAr: string }
interface Branch { id: string; nameAr: string }
interface BankAccount { id: string; nameAr: string; bankName: string }
interface Collection {
  id: string;
  month: number;
  year: number;
  collectedAmount: string;
  collectedDate: string;
  status: string;
  notes?: string | null;
  investor: { nameAr: string };
}

const STATUS_LABELS: Record<string, string> = {
  COLLECTED: "محصل",
  PARTIALLY_DISBURSED: "مصروف جزئياً",
  FULLY_DISBURSED: "مصروف بالكامل",
};

const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const now = new Date();
const EMPTY = {
  investorId: "", branchId: "", month: now.getMonth() + 1,
  year: now.getFullYear(), collectedAmount: "",
  collectedDate: now.toISOString().slice(0, 10),
  bankAccountId: "", notes: "",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function InvestorSalariesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit modal
  const [editItem, setEditItem] = useState<Collection | null>(null);
  const [editForm, setEditForm] = useState({ month: 1, year: now.getFullYear(), collectedAmount: "", collectedDate: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c, d] = await Promise.all([
      fetch(`/api/investors/salary-collections?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((r) => r.json()),
    ]);
    if (a.success) setCollections(a.data);
    if (b.success) setInvestors(b.data);
    if (c.success) setBranches(c.data);
    if (d.success) setBankAccounts(d.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function f<K extends keyof typeof EMPTY>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function save() {
    if (!form.investorId) { setFormError("اختر المسئول"); return; }
    if (!form.collectedAmount || Number(form.collectedAmount) <= 0) { setFormError("أدخل مبلغاً صحيحاً"); return; }
    setSaving(true); setFormError("");
    const res = await fetch("/api/investors/salary-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        investorId: form.investorId,
        branchId: form.branchId || undefined,
        month: Number(form.month),
        year: Number(form.year),
        collectedAmount: Number(form.collectedAmount),
        collectedDate: form.collectedDate,
        bankAccountId: form.bankAccountId || undefined,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  function openEdit(col: Collection) {
    setEditItem(col);
    setEditForm({
      month: col.month,
      year: col.year,
      collectedAmount: Number(col.collectedAmount).toFixed(3),
      collectedDate: new Date(col.collectedDate).toISOString().slice(0, 10),
      notes: col.notes ?? "",
    });
    setEditError("");
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editForm.collectedAmount || Number(editForm.collectedAmount) <= 0) { setEditError("أدخل مبلغاً صحيحاً"); return; }
    setEditSaving(true); setEditError("");
    const res = await fetch(`/api/investors/salary-collections/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(editForm.month),
        year: Number(editForm.year),
        collectedAmount: Number(editForm.collectedAmount),
        collectedDate: editForm.collectedDate,
        notes: editForm.notes || null,
      }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!data.success) { setEditError(data.error ?? "فشل الحفظ"); return; }
    setEditItem(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/investors/salary-collections/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    setDeleteId(null);
    load();
  }

  const total = collections.reduce((s, c) => s + Number(c.collectedAmount), 0);
  const pending = collections.filter((c) => c.status === "COLLECTED").length;

  return (
    <div>
      <Header
        title="رواتب المسئولين والمديرين"
        subtitle="دورات تحصيل رواتب موظفي المسئولين والمديرين"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + تسجيل تحصيل
          </button>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي المحصل</p>
            <p className="number mt-1 text-xl font-bold">{total.toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">سجلات التحصيل</p>
            <p className="mt-1 text-2xl font-bold">{collections.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">بانتظار الصرف</p>
            <p className={`mt-1 text-2xl font-bold ${pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{pending}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>المسئول والمدير</th>
                    <th>الفترة</th>
                    <th>المبلغ المحصل</th>
                    <th>تاريخ التحصيل</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {collections.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">لا توجد تحصيلات — اضغط "تسجيل تحصيل"</td></tr>
                  ) : collections.map((col) => (
                    <tr key={col.id} className="hover:bg-muted/30">
                      <td className="font-medium">{col.investor.nameAr}</td>
                      <td>{MONTHS[col.month - 1]} {col.year}</td>
                      <td className="number font-bold text-green-600">
                        {Number(col.collectedAmount).toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك
                      </td>
                      <td className="text-sm">{new Date(col.collectedDate).toLocaleDateString("ar-KW")}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          col.status === "FULLY_DISBURSED" ? "bg-green-100 text-green-700" :
                          col.status === "PARTIALLY_DISBURSED" ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {STATUS_LABELS[col.status] ?? col.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(col)}
                            className="rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="تعديل"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setDeleteId(col.id); setDeleteError(""); }}
                            className="rounded p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showForm && (
        <Modal title="تسجيل تحصيل رواتب مسئول" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">المسئول والمدير *</label>
              <select className="input-field w-full" value={form.investorId} onChange={f("investorId")}>
                <option value="">— اختر المسئول —</option>
                {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">الفرع (اختياري)</label>
              <select className="input-field w-full" value={form.branchId} onChange={f("branchId")}>
                <option value="">— بدون فرع —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الشهر</label>
                <select className="input-field w-full" value={form.month} onChange={f("month")}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">السنة</label>
                <input type="number" className="input-field w-full" value={form.year} onChange={f("year")} min={2020} max={2100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">المبلغ المحصل (د.ك) *</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={form.collectedAmount} onChange={f("collectedAmount")} />
              </div>
              <div>
                <label className="form-label">تاريخ التحصيل *</label>
                <input type="date" className="input-field w-full" value={form.collectedDate} onChange={f("collectedDate")} />
              </div>
            </div>
            <div>
              <label className="form-label">الحساب البنكي (اختياري)</label>
              <select className="input-field w-full" value={form.bankAccountId} onChange={f("bankAccountId")}>
                <option value="">— نقدي —</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.nameAr} — {b.bankName}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field w-full" rows={2} value={form.notes} onChange={f("notes")} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "تسجيل"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Modal title={`تعديل: ${editItem.investor.nameAr}`} onClose={() => setEditItem(null)}>
          <div className="space-y-3">
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
                <input type="number" className="input-field w-full" value={editForm.year}
                  onChange={(e) => setEditForm((p) => ({ ...p, year: Number(e.target.value) }))} min={2020} max={2100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">المبلغ المحصل (د.ك) *</label>
                <input type="number" step="0.001" min="0" className="input-field w-full" value={editForm.collectedAmount}
                  onChange={(e) => setEditForm((p) => ({ ...p, collectedAmount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">تاريخ التحصيل</label>
                <input type="date" className="input-field w-full" value={editForm.collectedDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, collectedDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field w-full" rows={2} value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            {editError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditItem(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {editSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="تأكيد الحذف" onClose={() => !deleting && setDeleteId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">هل تريد حذف سجل التحصيل هذا نهائياً؟</p>
            <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-yellow-800">
              ⚠️ سيتم إلغاء القيد المحاسبي المرتبط بهذا التحصيل تلقائياً. هذا الإجراء يتطلب صلاحية المشرف العام.
            </p>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Trash2 size={14} />}
                {deleting ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
