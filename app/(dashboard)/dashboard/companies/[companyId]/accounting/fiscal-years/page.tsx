"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Lock, Unlock, X } from "lucide-react";
import { Header } from "@/components/layout/header";

interface FiscalYear {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
  companyId: string;
}

const EMPTY = { year: new Date().getFullYear(), startDate: "", endDate: "", isCurrent: false };
type Form = typeof EMPTY;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function FiscalYearsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/accounting/fiscal-years?companyId=${companyId}`);
    const data = await res.json();
    if (data.success) setYears(data.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.startDate || !form.endDate) { setFormError("تواريخ البداية والنهاية مطلوبة"); return; }
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/accounting/fiscal-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...form }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  async function toggleLock(fy: FiscalYear) {
    await fetch(`/api/accounting/fiscal-years/${fy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !fy.isLocked }),
    });
    load();
  }

  async function setCurrent(fy: FiscalYear) {
    await fetch(`/api/accounting/fiscal-years/${fy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCurrent: true }),
    });
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteError("");
    const res = await fetch(`/api/accounting/fiscal-years/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    setDeleteId(null);
    load();
  }

  const current = years.find((y) => y.isCurrent);

  return (
    <div>
      <Header
        title="السنوات المالية"
        subtitle="إدارة السنوات المالية وحالة الإقفال"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + إضافة سنة مالية
          </button>
        }
      />
      <div className="page-container space-y-4">
        {current && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            السنة المالية الحالية: <strong>{current.year}</strong> ({new Date(current.startDate).toLocaleDateString("ar-KW")} — {new Date(current.endDate).toLocaleDateString("ar-KW")})
            {current.isLocked && <span className="mr-2 text-orange-600">• مقفلة</span>}
          </div>
        )}

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>السنة</th>
                    <th>تاريخ البداية</th>
                    <th>تاريخ النهاية</th>
                    <th>الحالة</th>
                    <th>قفل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {years.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        لا توجد سنوات مالية — اضغط "إضافة سنة مالية" للبدء
                      </td>
                    </tr>
                  ) : years.map((fy) => (
                    <tr key={fy.id}>
                      <td className="font-bold text-lg">{fy.year}</td>
                      <td>{new Date(fy.startDate).toLocaleDateString("ar-KW")}</td>
                      <td>{new Date(fy.endDate).toLocaleDateString("ar-KW")}</td>
                      <td>
                        {fy.isCurrent ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            حالية
                          </span>
                        ) : (
                          <button
                            onClick={() => setCurrent(fy)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            تعيين كحالية
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleLock(fy)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            fy.isLocked
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {fy.isLocked ? <><Lock size={12} /> مقفلة</> : <><Unlock size={12} /> مفتوحة</>}
                        </button>
                      </td>
                      <td>
                        {!fy.isCurrent && !fy.isLocked && (
                          <button
                            onClick={() => { setDeleteId(fy.id); setDeleteError(""); }}
                            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="إضافة سنة مالية" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">السنة</label>
              <input
                type="number"
                className="input-field"
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) }))}
                min={2020}
                max={2100}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">تاريخ البداية *</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">تاريخ النهاية *</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrentCheck"
                checked={form.isCurrent}
                onChange={(e) => setForm((p) => ({ ...p, isCurrent: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="isCurrentCheck" className="text-sm">تعيين كسنة مالية حالية</label>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "إضافة"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="تأكيد الحذف" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذه السنة المالية؟ يجب ألا تحتوي على أي قيود.</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              حذف
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
