"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  isHeader: boolean;
}

interface JournalLine {
  accountId: string;
  descriptionAr: string;
  debit: string;
  credit: string;
}

const ENTRY_TYPES = {
  ar: [
    { value: "GENERAL", label: "قيد عام" },
    { value: "RECEIPT", label: "قبض" },
    { value: "PAYMENT", label: "صرف" },
    { value: "TRANSFER", label: "تحويل" },
    { value: "SALARY", label: "رواتب" },
    { value: "EXPENSE", label: "مصروف" },
    { value: "ADJUSTMENT", label: "تسوية" },
    { value: "OPENING_BALANCE", label: "رصيد افتتاحي" },
  ],
  en: [
    { value: "GENERAL", label: "General" },
    { value: "RECEIPT", label: "Receipt" },
    { value: "PAYMENT", label: "Payment" },
    { value: "TRANSFER", label: "Transfer" },
    { value: "SALARY", label: "Salary" },
    { value: "EXPENSE", label: "Expense" },
    { value: "ADJUSTMENT", label: "Adjustment" },
    { value: "OPENING_BALANCE", label: "Opening balance" },
  ],
} as const;

const emptyLine = (): JournalLine => ({
  accountId: "",
  descriptionAr: "",
  debit: "",
  credit: "",
});

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const today = new Date().toISOString().split("T")[0];

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "GENERAL",
    date: today,
    descriptionAr: "",
    reference: "",
  });
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  useEffect(() => {
    fetch(`/api/accounting/accounts?companyId=${companyId}&pageSize=500`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.filter((account: Account) => !account.isHeader));
      })
      .catch(() => undefined);
  }, [companyId]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function setLine(index: number, field: keyof JournalLine, value: string) {
    setLines((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLine() {
    setLines((previous) => [...previous, emptyLine()]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;
    setLines((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }

  const totalDebit = lines.reduce((sum, line) => sum + (Number.parseFloat(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number.parseFloat(line.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.001 && totalDebit > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!isBalanced) {
      setError(locale === "en" ? "Entry is not balanced" : "القيد غير متوازن");
      return;
    }

    if (lines.some((line) => !line.accountId)) {
      setError(locale === "en" ? "Please select an account for every line" : "يرجى اختيار الحساب لجميع السطور");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/accounting/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          date: form.date,
          descriptionAr: form.descriptionAr,
          type: form.type,
          reference: form.reference || undefined,
          lines: lines.map((line) => ({
            accountId: line.accountId,
            descriptionAr: line.descriptionAr || undefined,
            debit: Number.parseFloat(line.debit) || 0,
            credit: Number.parseFloat(line.credit) || 0,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      }
      router.push(`/dashboard/companies/${companyId}/accounting/journal-entries/${payload.data.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New Journal Entry" : "قيد يومي جديد"}
        subtitle={locale === "en" ? "Create a manual journal entry" : "إدخال قيد محاسبي يدوي"}
        companyId={companyId}
      />

      <div className="page-container max-w-5xl">
        <div className="mb-4">
          <Link
            href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {locale === "en" ? "Back to journal entries" : "العودة إلى القيود"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Entry details" : "بيانات القيد"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Entry type" : "نوع القيد"}
                </label>
                <select
                  value={form.type}
                  onChange={(event) => setField("type", event.target.value)}
                  className="input-field w-full"
                >
                  {ENTRY_TYPES[locale].map((entryType) => (
                    <option key={entryType.value} value={entryType.value}>
                      {entryType.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Date" : "التاريخ"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => setField("date", event.target.value)}
                  className="input-field w-full"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Description" : "البيان"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={form.descriptionAr}
                  onChange={(event) => setField("descriptionAr", event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Entry description..." : "وصف القيد..."}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Reference" : "المرجع"}
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(event) => setField("reference", event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Optional reference" : "مرجع اختياري"}
                />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Entry lines" : "سطور القيد"}
              </h3>
              <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus size={14} />
                {locale === "en" ? "Add line" : "إضافة سطر"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-right font-bold text-muted-foreground">
                      {locale === "en" ? "Account" : "الحساب"}
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-muted-foreground">
                      {locale === "en" ? "Description" : "البيان"}
                    </th>
                    <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">
                      {locale === "en" ? "Debit" : "مدين"}
                    </th>
                    <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">
                      {locale === "en" ? "Credit" : "دائن"}
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="min-w-56 px-3 py-2">
                        <select
                          required
                          value={line.accountId}
                          onChange={(event) => setLine(index, "accountId", event.target.value)}
                          className="input-field w-full text-sm"
                        >
                          <option value="">{locale === "en" ? "Select account..." : "اختر الحساب..."}</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.descriptionAr}
                          onChange={(event) => setLine(index, "descriptionAr", event.target.value)}
                          className="input-field w-full text-sm"
                          placeholder={locale === "en" ? "Line description..." : "بيان السطر..."}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={line.debit}
                          onChange={(event) => {
                            setLine(index, "debit", event.target.value);
                            if (event.target.value) setLine(index, "credit", "");
                          }}
                          className="input-field number w-full text-sm"
                          placeholder="0.000"
                          dir="ltr"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={line.credit}
                          onChange={(event) => {
                            setLine(index, "credit", event.target.value);
                            if (event.target.value) setLine(index, "debit", "");
                          }}
                          className="input-field number w-full text-sm"
                          placeholder="0.000"
                          dir="ltr"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                          className="text-red-400 transition-colors hover:text-red-600 disabled:opacity-20"
                          title={locale === "en" ? "Delete line" : "حذف السطر"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold">
                    <td className="px-3 py-2 text-center" colSpan={2}>
                      {locale === "en" ? "Total" : "الإجمالي"}
                    </td>
                    <td className="number px-3 py-2 text-left text-blue-600">{totalDebit.toFixed(3)}</td>
                    <td className="number px-3 py-2 text-left text-blue-600">{totalCredit.toFixed(3)}</td>
                    <td className="px-3 py-2 text-center">
                      {totalDebit > 0 && (
                        <span className={isBalanced ? "text-xs text-green-600" : "text-xs text-red-500"}>
                          {isBalanced ? "OK" : difference.toFixed(3)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !isBalanced}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Save entry" : "حفظ القيد"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
            {!isBalanced && totalDebit > 0 && (
              <span className="text-sm text-red-500">
                {locale === "en" ? `Difference: ${difference.toFixed(3)} - entry is not balanced` : `الفرق: ${difference.toFixed(3)} - القيد غير متوازن`}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
