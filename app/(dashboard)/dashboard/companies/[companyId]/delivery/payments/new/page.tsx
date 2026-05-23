"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

interface Contract { id: string; nameAr: string; nameEn?: string | null; platform: string }
interface BankAccount { id: string; nameAr: string; nameEn?: string | null }

export default function NewDeliveryPaymentPage() {
  const params = useParams<{ companyId: string }>();
  const { companyId } = params;
  const { locale } = useLocale();
  const router = useRouter();

  const now = new Date();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [form, setForm] = useState({
    contractId: "",
    platform: "TALABAT",
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    grossAmount: "",
    walletDeductions: "0",
    receivedDate: now.toISOString().slice(0, 10),
    bankAccountId: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/delivery/contracts?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([contractsPayload, bankPayload]) => {
      if (contractsPayload.success) setContracts(contractsPayload.data);
      if (bankPayload.success) setBankAccounts(bankPayload.data);
    }).catch(() => {
      setError(locale === "en" ? "Failed to load form data" : "تعذر تحميل بيانات النموذج");
    });
  }, [companyId, locale]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-detect platform from selected contract
  function handleContractChange(contractId: string) {
    const contract = contracts.find((c) => c.id === contractId);
    setForm((prev) => ({
      ...prev,
      contractId,
      platform: contract?.platform ?? prev.platform,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const gross = parseFloat(form.grossAmount);
    const wallet = parseFloat(form.walletDeductions || "0");
    if (!gross || gross <= 0) {
      setError(locale === "en" ? "Gross amount must be greater than 0" : "المبلغ الإجمالي يجب أن يكون أكبر من صفر");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/delivery/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          contractId: form.contractId || undefined,
          platform: form.platform,
          month: parseInt(form.month, 10),
          year: parseInt(form.year, 10),
          grossAmount: gross,
          walletDeductions: wallet,
          netReceived: gross - wallet,
          receivedDate: form.receivedDate,
          bankAccountId: form.bankAccountId || undefined,
          notes: form.notes || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      router.push(`/dashboard/companies/${companyId}/delivery/payments`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const gross = parseFloat(form.grossAmount || "0");
  const wallet = parseFloat(form.walletDeductions || "0");
  const net = gross - wallet;

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <Header
        title={locale === "en" ? "Record Company Payment" : "تسجيل دفعة الشركة"}
        subtitle={locale === "en" ? "Record delivery revenue received from a platform" : "تسجيل إيراد توصيل وارد من منصة"}
        companyId={companyId}
      />
      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/payments`}
          className="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to payments" : "العودة للمدفوعات"}
        </Link>

        <form onSubmit={handleSubmit} className="section-card space-y-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Contract" : "العقد"}</label>
              <select
                value={form.contractId}
                onChange={(e) => handleContractChange(e.target.value)}
                className="input-field w-full"
              >
                <option value="">{locale === "en" ? "Select contract" : "اختر العقد"}</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "en" ? c.nameEn ?? c.nameAr : c.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Platform" : "المنصة"} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.platform}
                onChange={(e) => setField("platform", e.target.value)}
                className="input-field w-full"
              >
                <option value="TALABAT">{locale === "en" ? "Talabat" : "طلبات"}</option>
                <option value="RO_POPS">Ro Pops</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Month" : "الشهر"} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.month}
                onChange={(e) => setField("month", e.target.value)}
                className="input-field w-full"
              >
                {MONTHS[locale].map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Year" : "السنة"} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.year}
                onChange={(e) => setField("year", e.target.value)}
                className="input-field w-full"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Received date" : "تاريخ الاستلام"} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.receivedDate}
                onChange={(e) => setField("receivedDate", e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Bank account" : "الحساب البنكي"}</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => setField("bankAccountId", e.target.value)}
                className="input-field w-full"
              >
                <option value="">{locale === "en" ? "Select bank account" : "اختر الحساب البنكي"}</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {locale === "en" ? ba.nameEn ?? ba.nameAr : ba.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Gross amount (KWD)" : "المبلغ الإجمالي (د.ك)"} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.001"
                min="0.001"
                value={form.grossAmount}
                onChange={(e) => setField("grossAmount", e.target.value)}
                className="input-field w-full"
                placeholder="0.000"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Wallet deductions (KWD)" : "خصومات المحفظة (د.ك)"}
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.walletDeductions}
                onChange={(e) => setField("walletDeductions", e.target.value)}
                className="input-field w-full"
                placeholder="0.000"
                dir="ltr"
              />
            </div>
          </div>

          {/* Net preview */}
          <div className="rounded-lg bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{locale === "en" ? "Net received (calculated):" : "صافي المستلم (محسوب):"}</span>
              <span className={`number font-bold text-lg ${net < 0 ? "text-red-600" : "text-green-600"}`}>
                {net.toFixed(3)} {locale === "en" ? "KWD" : "د.ك"}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              className="input-field w-full resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Record payment" : "تسجيل الدفعة"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/delivery/payments`}
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
