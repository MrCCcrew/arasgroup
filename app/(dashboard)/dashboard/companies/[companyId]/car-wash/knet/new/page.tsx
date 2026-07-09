"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckSquare, Save, Square } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { formatDate, formatKWD } from "@/lib/utils";

interface KnetTx {
  id: string;
  amount: number;
  date: string;
  cardType: string;
  transactionRef?: string;
  operation: { date: string; vehicle: { nameAr: string; nameEn?: string } };
}

interface CommissionSettings {
  [cardType: string]: {
    percentage: number;
    fixed: number;
  };
}

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  bankName: string;
}

export default function NewKnetSettlementPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const [transactions, setTransactions] = useState<KnetTx[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    bankAccountId: "",
    settlementDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/car-wash/knet-transactions?companyId=${companyId}&unsettled=true`).then((response) => response.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/car-wash/knet/commission-settings/${companyId}`).then((response) => response.json()),
    ]).then(([transactionPayload, bankPayload, commissionPayload]) => {
      if (transactionPayload.success) setTransactions(transactionPayload.data);
      if (bankPayload.success) setBankAccounts(bankPayload.data);
      if (commissionPayload.success) setCommissionSettings(commissionPayload.data);
      setLoading(false);
    });
  }, [companyId]);

  function toggleAll() {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((transaction) => transaction.id)));
    }
  }

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Calculate commission automatically
  const selectedTransactions = transactions.filter((tx) => selected.has(tx.id));
  const grossAmount = selectedTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Group by card type and calculate commission
  const commissionByType: Record<string, { count: number; amount: number; commission: number }> = {};
  let totalCommission = 0;

  selectedTransactions.forEach((tx) => {
    const cardType = tx.cardType || "KNET";
    const amount = Number(tx.amount);
    const settings = commissionSettings[cardType] || { percentage: 0, fixed: 0 };
    const txCommission = (amount * settings.percentage) / 100 + settings.fixed;

    if (!commissionByType[cardType]) {
      commissionByType[cardType] = { count: 0, amount: 0, commission: 0 };
    }
    commissionByType[cardType].count++;
    commissionByType[cardType].amount += amount;
    commissionByType[cardType].commission += txCommission;
    totalCommission += txCommission;
  });

  const commission = totalCommission;
  const netAmount = grossAmount - commission;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (selected.size === 0) {
      setError(locale === "en" ? "Select at least one transaction" : "اختر معاملة واحدة على الأقل");
      return;
    }
    if (!form.bankAccountId) {
      setError(locale === "en" ? "Select the bank account" : "اختر الحساب البنكي");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/car-wash/knet-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          bankAccountId: form.bankAccountId,
          settlementDate: form.settlementDate,
          grossAmount,
          commission,
          transactionIds: Array.from(selected),
          notes: form.notes || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      router.push(`/dashboard/companies/${companyId}/car-wash/knet`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page-container"><p className="text-muted-foreground">{locale === "en" ? "Loading..." : "جارٍ التحميل..."}</p></div>;
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New KNET Settlement" : "تسوية KNET جديدة"}
        subtitle={locale === "en" ? "Select transactions and create the settlement" : "تحديد المعاملات وإنشاء التسوية"}
        companyId={companyId}
      />
      <div className="page-container max-w-4xl">
        <Link href={`/dashboard/companies/${companyId}/car-wash/knet`} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight size={14} />
          {locale === "en" ? "Back to settlements" : "العودة"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Settlement details" : "بيانات التسوية"}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Bank account" : "الحساب البنكي"} <span className="text-red-500">*</span></label>
                <select required value={form.bankAccountId} onChange={(event) => setForm((previous) => ({ ...previous, bankAccountId: event.target.value }))} className="input-field w-full">
                  <option value="">{locale === "en" ? "Select..." : "اختر..."}</option>
                  {bankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {(locale === "en" ? bankAccount.nameEn ?? bankAccount.nameAr : bankAccount.nameAr) + " - " + bankAccount.bankName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Settlement date" : "تاريخ التسوية"}</label>
                <input type="date" value={form.settlementDate} onChange={(event) => setForm((previous) => ({ ...previous, settlementDate: event.target.value }))} className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
              <input type="text" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} className="input-field w-full" />
            </div>

            {/* Commission Breakdown */}
            {selected.size > 0 && Object.keys(commissionByType).length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-primary">{locale === "en" ? "Commission Breakdown" : "تفاصيل العمولة"}</h4>
                <div className="space-y-2">
                  {Object.entries(commissionByType).map(([cardType, data]) => (
                    <div key={cardType} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">{cardType}</span>
                        <span className="text-muted-foreground">
                          {data.count} {locale === "en" ? "transactions" : "معاملة"} × {formatKWD(data.amount / data.count, numberLocale)}
                        </span>
                      </div>
                      <span className="font-medium">{formatKWD(data.commission, numberLocale)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex items-center justify-between font-semibold">
                    <span>{locale === "en" ? "Total Commission" : "إجمالي العمولة"}</span>
                    <span className="text-red-600">{formatKWD(totalCommission, numberLocale)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card text-center">
              <span className="text-xs text-muted-foreground">{locale === "en" ? "Selected transactions" : "المعاملات المختارة"}</span>
              <span className="text-2xl font-bold">{selected.size}</span>
            </div>
            <div className="stat-card text-center">
              <span className="text-xs text-muted-foreground">{locale === "en" ? "Gross KNET" : "إجمالي KNET"}</span>
              <span className="number text-2xl font-bold">{formatKWD(grossAmount, numberLocale)}</span>
            </div>
            <div className="stat-card text-center">
              <span className="text-xs text-muted-foreground">{locale === "en" ? "Net transfer" : "صافي المحول"}</span>
              <span className={`number text-2xl font-bold ${netAmount < 0 ? "text-red-600" : "text-green-600"}`}>{formatKWD(netAmount, numberLocale)}</span>
            </div>
          </div>

          <div className="section-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? `Unsettled transactions (${transactions.length})` : `المعاملات غير المسواة (${transactions.length})`}
              </h3>
              <button type="button" onClick={toggleAll} className="flex items-center gap-1 text-xs text-primary hover:underline">
                {selected.size === transactions.length ? <CheckSquare size={13} /> : <Square size={13} />}
                {selected.size === transactions.length ? (locale === "en" ? "Clear all" : "إلغاء الكل") : locale === "en" ? "Select all" : "اختيار الكل"}
              </button>
            </div>

            {transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{locale === "en" ? "No unsettled KNET transactions" : "لا توجد معاملات KNET غير مسواة"}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th className="w-10"></th>
                      <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                      <th>{locale === "en" ? "Vehicle" : "السيارة"}</th>
                      <th>{locale === "en" ? "Amount (KWD)" : "المبلغ (د.ك)"}</th>
                      <th>{locale === "en" ? "Reference" : "المرجع"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className={`cursor-pointer ${selected.has(transaction.id) ? "bg-primary/5" : "hover:bg-muted/10"}`} onClick={() => toggle(transaction.id)}>
                        <td className="text-center">
                          {selected.has(transaction.id) ? <CheckSquare size={16} className="mx-auto text-primary" /> : <Square size={16} className="mx-auto text-muted-foreground" />}
                        </td>
                        <td className="text-sm">{formatDate(transaction.date, numberLocale)}</td>
                        <td className="text-sm">{locale === "en" ? transaction.operation?.vehicle?.nameEn ?? transaction.operation?.vehicle?.nameAr : transaction.operation?.vehicle?.nameAr ?? "-"}</td>
                        <td className="number font-medium">{formatKWD(Number(transaction.amount), numberLocale)}</td>
                        <td className="text-xs text-muted-foreground">{transaction.transactionRef ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || selected.size === 0} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} />
              {saving ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Create settlement" : "إنشاء التسوية"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/car-wash/knet`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
