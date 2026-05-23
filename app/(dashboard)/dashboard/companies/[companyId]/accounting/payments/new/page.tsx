"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, ArrowUpFromLine, Save } from "lucide-react";
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

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  bankName: string;
  accountNumber: string;
}

export default function NewPaymentPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({
    date: today,
    partyName: "",
    descriptionAr: "",
    amount: "",
    paymentMethod: "CASH" as "CASH" | "BANK",
    bankAccountId: "",
    debitAccountId: "",
    reference: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounting/accounts?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((response) => response.json()),
    ]).then(([accountPayload, bankPayload]) => {
      if (accountPayload.success) {
        setAccounts((accountPayload.data as Account[]).filter((account) => !account.isHeader));
      }
      if (bankPayload.success) {
        const banks = bankPayload.data as BankAccount[];
        setBankAccounts(banks);
        if (banks.length > 0) {
          setForm((previous) => ({ ...previous, bankAccountId: banks[0].id }));
        }
      }
    });
  }, [companyId]);

  function update(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.debitAccountId) {
      setError(locale === "en" ? "Please select the debit account" : "يرجى اختيار الحساب المدين");
      return;
    }

    if (!form.amount || Number.parseFloat(form.amount) <= 0) {
      setError(locale === "en" ? "Please enter a valid amount" : "يرجى إدخال مبلغ صحيح");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/accounting/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          date: form.date,
          descriptionAr: form.descriptionAr,
          amount: Number.parseFloat(form.amount),
          paymentMethod: form.paymentMethod,
          bankAccountId: form.paymentMethod === "BANK" ? form.bankAccountId : undefined,
          debitAccountId: form.debitAccountId,
          reference: form.reference || undefined,
          partyName: form.partyName || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));

      router.push(`/dashboard/companies/${companyId}/accounting/journal-entries/${payload.data.id}/print`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  const expenseAccounts = accounts.filter((account) => account.type === "EXPENSE");
  const liabilityAccounts = accounts.filter((account) => account.type === "LIABILITY");
  const otherAccounts = accounts.filter((account) => !["EXPENSE", "LIABILITY"].includes(account.type));

  return (
    <div>
      <Header
        title={locale === "en" ? "Payment Voucher" : "سند صرف"}
        subtitle={locale === "en" ? "Pay funds and create the journal entry automatically" : "دفع مبلغ وتوليد القيد المحاسبي تلقائياً"}
        companyId={companyId}
      />

      <div className="page-container max-w-xl">
        <Link
          href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to journal entries" : "العودة إلى القيود"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="section-card space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
              <ArrowUpFromLine size={16} className="shrink-0 text-orange-600" />
              <span className="text-orange-800">
                {locale === "en"
                  ? `Journal preview: debit the selected account and credit ${form.paymentMethod === "CASH" ? "cash" : "bank"}`
                  : `معاينة القيد: مدين الحساب المختار ودائن ${form.paymentMethod === "CASH" ? "الصندوق" : "البنك"}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Date" : "التاريخ"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => update("date", event.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Amount (KWD)" : "المبلغ (KWD)"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step="0.001"
                  value={form.amount}
                  onChange={(event) => update("amount", event.target.value)}
                  className="input-field w-full text-left"
                  dir="ltr"
                  placeholder="0.000"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Paid to" : "المدفوع إليه"}
              </label>
              <input
                type="text"
                value={form.partyName}
                onChange={(event) => update("partyName", event.target.value)}
                className="input-field w-full"
                placeholder={locale === "en" ? "Supplier or party name..." : "اسم المورد أو الجهة..."}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Description" : "البيان"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.descriptionAr}
                onChange={(event) => update("descriptionAr", event.target.value)}
                className="input-field w-full"
                placeholder={locale === "en" ? "Payment description..." : "وصف عملية الصرف..."}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {locale === "en" ? "Payment method" : "طريقة الصرف"} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["CASH", "BANK"] as const).map((method) => (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      form.paymentMethod === method
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={form.paymentMethod === method}
                      onChange={() => update("paymentMethod", method)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">
                      {method === "CASH"
                        ? locale === "en"
                          ? "Cash"
                          : "نقدي"
                        : locale === "en"
                          ? "Bank transfer"
                          : "تحويل بنكي"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {form.paymentMethod === "BANK" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Bank account" : "الحساب البنكي"}
                </label>
                <select
                  value={form.bankAccountId}
                  onChange={(event) => update("bankAccountId", event.target.value)}
                  className="input-field w-full"
                >
                  <option value="">{locale === "en" ? "Select bank..." : "اختر البنك..."}</option>
                  {bankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {(locale === "en" ? bankAccount.nameEn ?? bankAccount.nameAr : bankAccount.nameAr) ||
                        bankAccount.accountNumber}
                      {" - "}
                      {bankAccount.bankName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Debit account" : "الحساب المدين"} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.debitAccountId}
                onChange={(event) => update("debitAccountId", event.target.value)}
                className="input-field w-full"
                required
              >
                <option value="">{locale === "en" ? "Select account..." : "اختر الحساب..."}</option>
                {expenseAccounts.length > 0 && (
                  <optgroup label={locale === "en" ? "Expenses" : "مصروفات"}>
                    {expenseAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}
                      </option>
                    ))}
                  </optgroup>
                )}
                {liabilityAccounts.length > 0 && (
                  <optgroup label={locale === "en" ? "Liabilities / Payables" : "التزامات / دائنون"}>
                    {liabilityAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherAccounts.length > 0 && (
                  <optgroup label={locale === "en" ? "Other" : "أخرى"}>
                    {otherAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Reference / Voucher No." : "المرجع / رقم السند"}
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={(event) => update("reference", event.target.value)}
                className="input-field w-full"
                dir="ltr"
                placeholder="PV-001"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Create payment" : "إنشاء سند الصرف"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
