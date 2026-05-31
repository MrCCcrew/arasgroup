"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Lock, Unlock, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

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
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    title: en ? "Fiscal Years" : "السنوات المالية",
    subtitle: en ? "Manage fiscal years and locking" : "إدارة السنوات المالية وحالة الإقفال",
    add: en ? "Add fiscal year" : "إضافة سنة مالية",
    addModal: en ? "Add fiscal year" : "إضافة سنة مالية",
    datesRequired: en ? "Start and end dates are required" : "تواريخ البداية والنهاية مطلوبة",
    genericError: en ? "An error occurred" : "حدث خطأ",
    deleteFailed: en ? "Delete failed" : "فشل الحذف",
    current: en ? "Current fiscal year:" : "السنة المالية الحالية:",
    locked: en ? "Locked" : "مقفلة",
    open: en ? "Open" : "مفتوحة",
    loading: en ? "Loading..." : "جاري التحميل...",
    year: en ? "Year" : "السنة",
    startDate: en ? "Start date" : "تاريخ البداية",
    endDate: en ? "End date" : "تاريخ النهاية",
    status: en ? "Status" : "الحالة",
    lock: en ? "Lock" : "قفل",
    emptyList: en ? "No fiscal years — click \"Add fiscal year\" to start" : "لا توجد سنوات مالية — اضغط \"إضافة سنة مالية\" للبدء",
    isCurrent: en ? "Current" : "حالية",
    setCurrent: en ? "Set as current" : "تعيين كحالية",
    delete: en ? "Delete" : "حذف",
    setCurrentField: en ? "Set as current fiscal year" : "تعيين كسنة مالية حالية",
    cancel: en ? "Cancel" : "إلغاء",
    saving: en ? "Saving..." : "جاري الحفظ...",
    addBtn: en ? "Add" : "إضافة",
    confirmDelete: en ? "Confirm delete" : "تأكيد الحذف",
    deleteWarn: en ? "Are you sure you want to delete this fiscal year? It must contain no entries." : "هل أنت متأكد من حذف هذه السنة المالية؟ يجب ألا تحتوي على أي قيود.",
  };
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
    if (!form.startDate || !form.endDate) { setFormError(t.datesRequired); return; }
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/accounting/fiscal-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...form }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? t.genericError); return; }
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
    if (!data.success) { setDeleteError(data.error ?? t.deleteFailed); return; }
    setDeleteId(null);
    load();
  }

  const current = years.find((y) => y.isCurrent);

  return (
    <div>
      <Header
        title={t.title}
        subtitle={t.subtitle}
        companyId={companyId}
        actions={
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + {t.add}
          </button>
        }
      />
      <div className="page-container space-y-4">
        {current && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t.current} <strong>{current.year}</strong> ({new Date(current.startDate).toLocaleDateString(numberLocale)} — {new Date(current.endDate).toLocaleDateString(numberLocale)})
            {current.isLocked && <span className="mr-2 text-orange-600">• {t.locked}</span>}
          </div>
        )}

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t.loading}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{t.year}</th>
                    <th>{t.startDate}</th>
                    <th>{t.endDate}</th>
                    <th>{t.status}</th>
                    <th>{t.lock}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {years.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        {t.emptyList}
                      </td>
                    </tr>
                  ) : years.map((fy) => (
                    <tr key={fy.id}>
                      <td className="font-bold text-lg">{fy.year}</td>
                      <td>{new Date(fy.startDate).toLocaleDateString(numberLocale)}</td>
                      <td>{new Date(fy.endDate).toLocaleDateString(numberLocale)}</td>
                      <td>
                        {fy.isCurrent ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {t.isCurrent}
                          </span>
                        ) : (
                          <button
                            onClick={() => setCurrent(fy)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            {t.setCurrent}
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
                          {fy.isLocked ? <><Lock size={12} /> {t.locked}</> : <><Unlock size={12} /> {t.open}</>}
                        </button>
                      </td>
                      <td>
                        {!fy.isCurrent && !fy.isLocked && (
                          <button
                            onClick={() => { setDeleteId(fy.id); setDeleteError(""); }}
                            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            {t.delete}
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
        <Modal title={t.addModal} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">{t.year}</label>
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
                <label className="form-label">{t.startDate} *</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">{t.endDate} *</label>
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
              <label htmlFor="isCurrentCheck" className="text-sm">{t.setCurrentField}</label>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? t.saving : t.addBtn}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title={t.confirmDelete} onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">{t.deleteWarn}</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
            <button
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t.delete}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
