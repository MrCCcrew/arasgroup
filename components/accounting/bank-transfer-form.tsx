"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRightLeft, Save } from "lucide-react";

interface BankAccount {
  id: string;
  nameAr: string;
  bankName: string;
  accountNumber: string;
}

interface Props {
  companyId: string;
  banks: BankAccount[];
  locale: string;
}

export function BankTransferForm({ companyId, banks, locale }: Props) {
  const router = useRouter();
  const en = locale === "en";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceBankId, setSourceBankId] = useState(banks[0]?.id ?? "");
  const [destinationBankId, setDestinationBankId] = useState(banks[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [purposeAr, setPurposeAr] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceBankId || !destinationBankId || !amount || !purposeAr) {
      setError(en ? "Please fill all required fields" : "املأ جميع الحقول المطلوبة");
      return;
    }
    if (sourceBankId === destinationBankId) {
      setError(en ? "Source and destination must be different" : "البنك المحول منه والمحول إليه يجب أن يكونا مختلفين");
      return;
    }
    if (Number(amount) <= 0) {
      setError(en ? "Amount must be greater than 0" : "المبلغ يجب أن يكون أكبر من صفر");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/bank-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          sourceBankAccountId: sourceBankId,
          destinationBankAccountId: destinationBankId,
          amount: Number(amount),
          transferDate,
          purposeAr,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push(`/dashboard/companies/${companyId}/accounting/bank-transfers`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : en ? "Failed to save" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const t = {
    from: en ? "From Bank" : "من بنك",
    to: en ? "To Bank" : "إلى بنك",
    amount: en ? "Amount (KWD)" : "المبلغ (د.ك)",
    date: en ? "Transfer Date" : "تاريخ التحويل",
    purpose: en ? "Purpose" : "الغرض",
    reference: en ? "Reference" : "المرجع",
    notes: en ? "Notes" : "ملاحظات",
    cancel: en ? "Cancel" : "إلغاء",
    save: en ? "Save Transfer" : "حفظ التحويل",
    saving: en ? "Saving..." : "جاري الحفظ...",
    required: "*",
    needBanks: en ? "You need at least 2 active bank accounts" : "تحتاج إلى بنكين نشطين على الأقل",
  };

  if (banks.length < 2) {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-6 text-center">
        <p className="text-lg font-medium text-yellow-900">{t.needBanks}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 rounded-xl border bg-card p-6">
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t.from} <span className="text-red-500">{t.required}</span>
        </label>
        <select
          value={sourceBankId}
          onChange={(e) => setSourceBankId(e.target.value)}
          className="input-field w-full"
          required
        >
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.nameAr} - {bank.bankName} ({bank.accountNumber})
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-center">
        <div className="rounded-full bg-primary/10 p-3">
          <ArrowRightLeft size={24} className="text-primary" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          {t.to} <span className="text-red-500">{t.required}</span>
        </label>
        <select
          value={destinationBankId}
          onChange={(e) => setDestinationBankId(e.target.value)}
          className="input-field w-full"
          required
        >
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.nameAr} - {bank.bankName} ({bank.accountNumber})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">
            {t.amount} <span className="text-red-500">{t.required}</span>
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field w-full"
            dir="ltr"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            {t.date} <span className="text-red-500">{t.required}</span>
          </label>
          <input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            className="input-field w-full"
            dir="ltr"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          {t.purpose} <span className="text-red-500">{t.required}</span>
        </label>
        <input
          type="text"
          value={purposeAr}
          onChange={(e) => setPurposeAr(e.target.value)}
          className="input-field w-full"
          placeholder={en ? "e.g., Operating expenses" : "مثال: تحويل لمصاريف تشغيلية"}
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">{t.reference}</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="input-field w-full"
          placeholder={en ? "Optional" : "اختياري"}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">{t.notes}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-field w-full"
          rows={3}
          placeholder={en ? "Optional notes" : "ملاحظات اختيارية"}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border px-5 py-2.5 text-sm hover:bg-muted"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t.saving}
            </>
          ) : (
            <>
              <Save size={16} />
              {t.save}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
