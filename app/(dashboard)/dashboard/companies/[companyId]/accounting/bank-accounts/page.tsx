"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  bankName: string;
  accountNumber: string;
  iban?: string | null;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY = {
  nameAr: "", nameEn: "", bankName: "", accountNumber: "",
  iban: "", currency: "KWD", isDefault: false,
};
type Form = typeof EMPTY;

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

export default function BankAccountsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const t = {
    title: en ? "Bank Accounts" : "الحسابات البنكية",
    subtitle: en ? "Manage company bank accounts" : "إدارة الحسابات البنكية للشركة",
    add: en ? "Add bank account" : "إضافة حساب بنكي",
    nameRequired: en ? "Account name is required" : "اسم الحساب مطلوب",
    bankRequired: en ? "Bank name is required" : "اسم البنك مطلوب",
    numberRequired: en ? "Account number is required" : "رقم الحساب مطلوب",
    genericError: en ? "An error occurred" : "حدث خطأ",
    deleteFailed: en ? "Delete failed" : "فشل الحذف",
    loading: en ? "Loading..." : "جاري التحميل...",
    accountName: en ? "Account name" : "اسم الحساب",
    bank: en ? "Bank" : "البنك",
    accountNumber: en ? "Account number" : "رقم الحساب",
    currency: en ? "Currency" : "العملة",
    default: en ? "Default" : "الافتراضي",
    empty: en ? "No bank accounts — click \"Add bank account\" to start" : "لا توجد حسابات بنكية — اضغط \"إضافة حساب بنكي\" للبدء",
    isDefault: en ? "Default" : "افتراضي",
    setDefault: en ? "Set as default" : "تعيين كافتراضي",
    disable: en ? "Disable" : "تعطيل",
    editModal: en ? "Edit bank account" : "تعديل الحساب البنكي",
    addModal: en ? "Add bank account" : "إضافة حساب بنكي",
    nameArLabel: en ? "Account name (Arabic) *" : "اسم الحساب (عربي) *",
    nameEnLabel: en ? "Account name (English)" : "اسم الحساب (إنجليزي)",
    bankNameLabel: en ? "Bank name *" : "اسم البنك *",
    accountNumberLabel: en ? "Account number *" : "رقم الحساب *",
    defaultAccount: en ? "Default account" : "حساب افتراضي",
    cancel: en ? "Cancel" : "إلغاء",
    saving: en ? "Saving..." : "جاري الحفظ...",
    save: en ? "Save" : "حفظ",
    addBtn: en ? "Add" : "إضافة",
    confirmDisable: en ? "Confirm disable" : "تأكيد التعطيل",
    disableWarn: en ? "This bank account will be disabled and hidden from dropdowns." : "سيتم تعطيل هذا الحساب البنكي ولن يظهر في القوائم المنسدلة.",
    curKWD: en ? "Kuwaiti Dinar (KWD)" : "دينار كويتي (KWD)",
    curUSD: en ? "US Dollar (USD)" : "دولار أمريكي (USD)",
    curEUR: en ? "Euro (EUR)" : "يورو (EUR)",
    curSAR: en ? "Saudi Riyal (SAR)" : "ريال سعودي (SAR)",
  };
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/accounting/bank-accounts?companyId=${companyId}`);
    const data = await res.json();
    if (data.success) setAccounts(data.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function f<K extends keyof Form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(acc: BankAccount) {
    setEditId(acc.id);
    setForm({
      nameAr: acc.nameAr, nameEn: acc.nameEn ?? "",
      bankName: acc.bankName, accountNumber: acc.accountNumber,
      iban: acc.iban ?? "", currency: acc.currency, isDefault: acc.isDefault,
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.nameAr.trim()) { setFormError(t.nameRequired); return; }
    if (!form.bankName.trim()) { setFormError(t.bankRequired); return; }
    if (!form.accountNumber.trim()) { setFormError(t.numberRequired); return; }
    setSaving(true);
    setFormError("");
    const body = {
      companyId, ...form,
      nameEn: form.nameEn || null,
      iban: form.iban || null,
    };
    const res = await fetch(editId ? `/api/accounting/bank-accounts/${editId}` : "/api/accounting/bank-accounts", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? t.genericError); return; }
    setShowForm(false);
    load();
  }

  async function toggleDefault(acc: BankAccount) {
    await fetch(`/api/accounting/bank-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteError("");
    const res = await fetch(`/api/accounting/bank-accounts/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) { setDeleteError(data.error ?? t.deleteFailed); return; }
    setDeleteId(null);
    load();
  }

  return (
    <div>
      <Header
        title={t.title}
        subtitle={t.subtitle}
        companyId={companyId}
        actions={
          <button onClick={openAdd} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            + {t.add}
          </button>
        }
      />
      <div className="page-container">
        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t.loading}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{t.accountName}</th>
                    <th>{t.bank}</th>
                    <th>{t.accountNumber}</th>
                    <th>IBAN</th>
                    <th>{t.currency}</th>
                    <th>{t.default}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        {t.empty}
                      </td>
                    </tr>
                  ) : accounts.map((acc) => (
                    <tr key={acc.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(acc)}>
                      <td className="font-medium">{en ? acc.nameEn ?? acc.nameAr : acc.nameAr}</td>
                      <td>{acc.bankName}</td>
                      <td className="font-mono text-sm">{acc.accountNumber}</td>
                      <td className="font-mono text-xs text-muted-foreground">{acc.iban ?? "—"}</td>
                      <td>{acc.currency}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {acc.isDefault ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {t.isDefault}
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleDefault(acc)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            {t.setDefault}
                          </button>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setDeleteId(acc.id); setDeleteError(""); }}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          {t.disable}
                        </button>
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
        <Modal title={editId ? t.editModal : t.addModal} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t.nameArLabel}</label>
                <input className="input-field" value={form.nameAr} onChange={f("nameAr")} />
              </div>
              <div>
                <label className="form-label">{t.nameEnLabel}</label>
                <input className="input-field" dir="ltr" value={form.nameEn} onChange={f("nameEn")} />
              </div>
            </div>
            <div>
              <label className="form-label">{t.bankNameLabel}</label>
              <input className="input-field" value={form.bankName} onChange={f("bankName")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t.accountNumberLabel}</label>
                <input className="input-field" dir="ltr" value={form.accountNumber} onChange={f("accountNumber")} />
              </div>
              <div>
                <label className="form-label">{t.currency}</label>
                <select className="input-field" value={form.currency} onChange={f("currency")}>
                  <option value="KWD">{t.curKWD}</option>
                  <option value="USD">{t.curUSD}</option>
                  <option value="EUR">{t.curEUR}</option>
                  <option value="SAR">{t.curSAR}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">IBAN</label>
              <input className="input-field" dir="ltr" value={form.iban} onChange={f("iban")} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefaultCheck"
                checked={form.isDefault}
                onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="isDefaultCheck" className="text-sm">{t.defaultAccount}</label>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? t.saving : editId ? t.save : t.addBtn}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title={t.confirmDisable} onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">{t.disableWarn}</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
            <button
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t.disable}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
