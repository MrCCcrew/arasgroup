"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { PrintButton } from "@/components/ui/print-button";
import { useLocale } from "@/components/providers/locale-provider";

const TYPE_LABELS = {
  ar: {
    ASSET: "أصول",
    LIABILITY: "التزامات",
    EQUITY: "حقوق الملكية",
    REVENUE: "إيرادات",
    EXPENSE: "مصروفات",
  },
  en: {
    ASSET: "Assets",
    LIABILITY: "Liabilities",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    EXPENSE: "Expenses",
  },
} as const;

const TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700",
  LIABILITY: "bg-red-50 text-red-700",
  EQUITY: "bg-purple-50 text-purple-700",
  REVENUE: "bg-green-50 text-green-700",
  EXPENSE: "bg-orange-50 text-orange-700",
};

interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  normalBalance: string;
  level: number;
  isHeader: boolean;
  parentId?: string;
  notes?: string;
}

interface DeleteError {
  error: string;
  type: string;
  count?: number;
  entries?: { id: string; number: string; date: string; descriptionAr: string }[];
}

const BLANK_FORM = {
  code: "",
  nameAr: "",
  nameEn: "",
  type: "ASSET",
  parentId: "",
  isHeader: false,
  normalBalance: "DEBIT",
  notes: "",
};

export default function AccountsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const typeFilter = searchParams.get("type") ?? "";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState<DeleteError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/accounting/accounts?companyId=${companyId}${typeFilter ? `&type=${typeFilter}` : ""}`);
    const payload = await response.json();
    if (payload.success) setAccounts(payload.data);
    setLoading(false);
  }, [companyId, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const countByType = accounts.reduce<Record<string, number>>((accumulator, account) => {
    accumulator[account.type] = (accumulator[account.type] ?? 0) + 1;
    return accumulator;
  }, {});

  function openAdd() {
    setEditId(null);
    setForm({ ...BLANK_FORM });
    setError("");
    setShowAdd(true);
  }

  function openEdit(account: Account) {
    setEditId(account.id);
    setForm({
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn ?? "",
      type: account.type,
      parentId: account.parentId ?? "",
      isHeader: account.isHeader,
      normalBalance: account.normalBalance,
      notes: account.notes ?? "",
    });
    setError("");
    setShowAdd(true);
  }

  function closeForm() {
    setShowAdd(false);
    setEditId(null);
    setError("");
    setForm({ ...BLANK_FORM });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const isEdit = Boolean(editId);
      const response = await fetch(
        isEdit ? `/api/accounting/accounts/${editId}` : "/api/accounting/accounts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  code: form.code,
                  nameAr: form.nameAr,
                  nameEn: form.nameEn || undefined,
                  type: form.type,
                  parentId: form.parentId || null,
                  isHeader: form.isHeader,
                  normalBalance: form.normalBalance,
                  notes: form.notes || undefined,
                }
              : { ...form, companyId, isHeader: form.isHeader },
          ),
        },
      );
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error);
      closeForm();
      await load();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Failed to save" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: Account) {
    setDeleteError(null);
    const response = await fetch(`/api/accounting/accounts/${account.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!payload.success) {
      setDeleteError(payload);
      return;
    }
    await load();
  }

  const filtered = typeFilter ? accounts.filter((account) => account.type === typeFilter) : accounts;
  const filters = ["", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

  return (
    <div>
      <Header
        title={locale === "en" ? "Chart of Accounts" : "دليل الحسابات"}
        subtitle={locale === "en" ? "Accounting account tree" : "شجرة الحسابات المحاسبية"}
        companyId={companyId}
        actions={
          <div className="flex gap-2">
            <PrintButton />
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New account" : "حساب جديد"}
            </button>
          </div>
        }
      />

      <div className="page-container space-y-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((type) => {
            const active = typeFilter === type;
            const label = type ? `${TYPE_LABELS[locale][type]} (${countByType[type] ?? 0})` : `${locale === "en" ? "All" : "الكل"} (${accounts.length})`;
            return (
              <Link
                key={type}
                href={`/dashboard/companies/${companyId}/accounting/accounts${type ? `?type=${type}` : ""}`}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active || (!typeFilter && !type)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {deleteError && (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">{deleteError.error}</p>
                {deleteError.type === "HAS_TRANSACTIONS" && deleteError.entries && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-red-600">
                      {locale === "en"
                        ? `Linked journal entries (${deleteError.entries.length} latest items):`
                        : `القيود المرتبطة بهذا الحساب (${deleteError.entries.length} من الأحدث):`}
                    </p>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto">
                      {deleteError.entries.map((entry) => (
                        <Link
                          key={entry.id}
                          href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}`}
                          target="_blank"
                          className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs transition-colors hover:bg-red-50"
                        >
                          <ExternalLink size={12} className="shrink-0 text-red-500" />
                          <span className="font-mono text-red-700">{entry.number}</span>
                          <span className="text-red-600">{new Date(entry.date).toLocaleDateString(locale === "en" ? "en-US" : "ar-KW")}</span>
                          <span className="truncate text-muted-foreground">{entry.descriptionAr}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setDeleteError(null)} className="rounded p-1 hover:bg-red-100">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {showAdd && (
          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold">
              {editId
                ? locale === "en" ? "Edit account" : "تعديل الحساب"
                : locale === "en" ? "Add new account" : "إضافة حساب جديد"}
            </h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Account code *" : "كود الحساب *"}</label>
                  <input required type="text" value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))} className="input-field w-full text-sm" placeholder="1001" dir="ltr" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Arabic account name *" : "اسم الحساب بالعربي *"}</label>
                  <input required type="text" value={form.nameAr} onChange={(event) => setForm((previous) => ({ ...previous, nameAr: event.target.value }))} className="input-field w-full text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Type *" : "النوع *"}</label>
                  <select value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))} className="input-field w-full text-sm">
                    {Object.entries(TYPE_LABELS[locale]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Parent account" : "الحساب الأب"}</label>
                  <select value={form.parentId} onChange={(event) => setForm((previous) => ({ ...previous, parentId: event.target.value }))} className="input-field w-full text-sm">
                    <option value="">{locale === "en" ? "None" : "بدون"}</option>
                    {accounts
                      .filter((account) => account.isHeader && account.type === form.type && account.id !== editId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Normal balance" : "الرصيد الطبيعي"}</label>
                  <select value={form.normalBalance} onChange={(event) => setForm((previous) => ({ ...previous, normalBalance: event.target.value }))} className="input-field w-full text-sm">
                    <option value="DEBIT">{locale === "en" ? "Debit" : "مدين"}</option>
                    <option value="CREDIT">{locale === "en" ? "Credit" : "دائن"}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "English name" : "اسم الحساب بالإنجليزي"}</label>
                  <input type="text" value={form.nameEn} onChange={(event) => setForm((previous) => ({ ...previous, nameEn: event.target.value }))} className="input-field w-full text-sm" dir="ltr" />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                  <input type="text" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} className="input-field w-full text-sm" />
                </div>
                <div className="flex items-end gap-2 md:col-span-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isHeader} onChange={(event) => setForm((previous) => ({ ...previous, isHeader: event.target.checked }))} className="h-4 w-4 accent-primary" />
                    {locale === "en" ? "Header account (no direct entries)" : "حساب رئيسي لا يقبل قيوداً مباشرة"}
                  </label>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Check size={15} />
                  {saving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : editId ? (locale === "en" ? "Save" : "حفظ") : locale === "en" ? "Add" : "إضافة"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  {locale === "en" ? "Cancel" : "إلغاء"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Code" : "الكود"}</th>
                  <th>{locale === "en" ? "Account name" : "اسم الحساب"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Normal balance" : "الرصيد الطبيعي"}</th>
                  <th className="text-center">{locale === "en" ? "Level" : "المستوى"}</th>
                  <th className="text-center">{locale === "en" ? "Header" : "رئيسي"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {locale === "en" ? "Loading..." : "جاري التحميل..."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((account) => (
                    <tr key={account.id} className={`transition-colors hover:bg-muted/20 ${account.isHeader ? "bg-muted/10 font-semibold" : ""}`}>
                      <td className="font-mono text-xs">{account.code}</td>
                      <td style={{ paddingRight: `${(account.level - 1) * 16 + 16}px` }}>
                        <span className="text-sm">{locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}</span>
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_COLORS[account.type]}`}>
                          {TYPE_LABELS[locale][account.type as keyof typeof TYPE_LABELS.ar]}
                        </span>
                      </td>
                      <td className="text-xs">{account.normalBalance === "DEBIT" ? (locale === "en" ? "Debit" : "مدين") : locale === "en" ? "Credit" : "دائن"}</td>
                      <td className="text-center text-xs">{account.level}</td>
                      <td className="text-center">
                        {account.isHeader ? (
                          <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
                            {locale === "en" ? "Header" : "رئيسي"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(account)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={locale === "en" ? "Edit" : "تعديل"}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(account)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title={locale === "en" ? "Delete" : "حذف"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
