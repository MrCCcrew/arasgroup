"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Category {
  id: string;
  nameAr: string;
  nameEn?: string;
  type: string;
}

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  bankName: string;
}

const PAYMENT_METHOD_LABELS = {
  ar: {
    CASH: "نقدي",
    BANK: "تحويل بنكي",
    CARD: "بطاقة",
    CHEQUE: "شيك",
  },
  en: {
    CASH: "Cash",
    BANK: "Bank transfer",
    CARD: "Card",
    CHEQUE: "Cheque",
  },
} as const;

export default function NewExpensePage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({
    categoryId: "",
    date: today,
    descriptionAr: "",
    amount: "",
    paymentMethod: "CASH",
    bankAccountId: "",
    reference: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/expenses/categories?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((response) => response.json()),
    ]).then(([categoryPayload, bankPayload]) => {
      if (categoryPayload.success) {
        setCategories(categoryPayload.data);
        if (categoryPayload.data.length > 0) setField("categoryId", categoryPayload.data[0].id);
      }
      if (bankPayload.success) setBankAccounts(bankPayload.data);
    });
  }, [companyId]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  const needsBankAccount = form.paymentMethod === "BANK" || form.paymentMethod === "CHEQUE";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.categoryId) {
      setError(locale === "en" ? "Please select an expense category" : "يرجى اختيار فئة المصروف");
      return;
    }
    if (!form.amount || Number.parseFloat(form.amount) <= 0) {
      setError(locale === "en" ? "Please enter a valid amount" : "يرجى إدخال مبلغ صحيح");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          categoryId: form.categoryId,
          date: form.date,
          descriptionAr: form.descriptionAr,
          amount: Number.parseFloat(form.amount),
          paymentMethod: form.paymentMethod,
          bankAccountId: needsBankAccount && form.bankAccountId ? form.bankAccountId : undefined,
          reference: form.reference || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      router.push(`/dashboard/companies/${companyId}/expenses`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header title={locale === "en" ? "New Expense" : "مصروف جديد"} subtitle={locale === "en" ? "Register a new expense" : "تسجيل مصروف جديد"} companyId={companyId} />

      <div className="page-container max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Link href={`/dashboard/companies/${companyId}/expenses`} className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowRight size={14} />
            {locale === "en" ? "Back to expenses" : "العودة للمصروفات"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Expense category" : "فئة المصروف"} <span className="text-red-500">*</span></label>
              <select required value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)} className="input-field w-full">
                <option value="">{locale === "en" ? "Select category..." : "اختر الفئة..."}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {locale === "en" ? category.nameEn ?? category.nameAr : category.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Date" : "التاريخ"} <span className="text-red-500">*</span></label>
              <input type="date" required value={form.date} onChange={(event) => setField("date", event.target.value)} className="input-field w-full" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Description" : "البيان"} <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              minLength={3}
              value={form.descriptionAr}
              onChange={(event) => setField("descriptionAr", event.target.value)}
              className="input-field w-full"
              placeholder={locale === "en" ? "Expense description..." : "وصف المصروف..."}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Amount (KWD)" : "المبلغ (د.ك)"} <span className="text-red-500">*</span></label>
              <input type="number" required step="0.001" min="0.001" value={form.amount} onChange={(event) => setField("amount", event.target.value)} className="input-field w-full" placeholder="0.000" dir="ltr" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Payment method" : "طريقة الدفع"}</label>
              <select value={form.paymentMethod} onChange={(event) => setField("paymentMethod", event.target.value)} className="input-field w-full">
                {Object.entries(PAYMENT_METHOD_LABELS[locale]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsBankAccount && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Bank account" : "الحساب البنكي"}</label>
              <select value={form.bankAccountId} onChange={(event) => setField("bankAccountId", event.target.value)} className="input-field w-full">
                <option value="">{locale === "en" ? "Select account..." : "اختر الحساب..."}</option>
                {bankAccounts.map((bankAccount) => (
                  <option key={bankAccount.id} value={bankAccount.id}>
                    {(locale === "en" ? bankAccount.nameEn ?? bankAccount.nameAr : bankAccount.nameAr) + " - " + bankAccount.bankName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Reference / Invoice No." : "المرجع / رقم الفاتورة"}</label>
            <input
              type="text"
              value={form.reference}
              onChange={(event) => setField("reference", event.target.value)}
              className="input-field w-full"
              placeholder={locale === "en" ? "Invoice or reference number..." : "رقم الفاتورة أو المرجع..."}
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Save expense" : "حفظ المصروف"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/expenses`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
