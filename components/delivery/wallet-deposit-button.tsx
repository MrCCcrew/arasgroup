"use client";

import { useState, useEffect } from "react";
import { Loader2, Wallet, X } from "lucide-react";

interface BankAccount {
  id: string;
  nameAr: string;
  bankName: string;
}

interface Props {
  driverId: string;
  companyId: string;
  driverName: string;
  currentBalance: number;
  locale?: "ar" | "en";
  onSuccess?: () => void;
}

export function WalletDepositButton({
  driverId,
  companyId,
  driverName,
  currentBalance,
  locale = "ar",
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [descriptionAr, setDescriptionAr] = useState("");
  const [isBankDeposit, setIsBankDeposit] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(currentBalance);

  const remaining = balance - Number(amount || 0);

  // جلب البنوك عند فتح النموذج
  useEffect(() => {
    if (open && isBankDeposit && banks.length === 0) {
      setLoadingBanks(true);
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setBanks(json.data);
            if (json.data.length > 0) setBankAccountId(json.data[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingBanks(false));
    }
  }, [open, isBankDeposit, companyId, banks.length]);

  async function handleSave() {
    if (!amount || Number(amount) <= 0) {
      setError("أدخل مبلغاً صحيحاً");
      return;
    }
    if (isBankDeposit && !bankAccountId) {
      setError("اختر البنك");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId,
          companyId,
          amount: Number(amount),
          date,
          paymentMethod: isBankDeposit ? "BANK" : "CASH",
          bankAccountId: isBankDeposit ? bankAccountId : null,
          descriptionAr: descriptionAr || "إيداع محفظة سائق",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      // تحديث الرصيد محلياً
      setBalance((prev) => prev - Number(amount));
      setAmount("");
      setDescriptionAr("");
      setIsBankDeposit(false);
      setBankAccountId("");
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const fmtKWD = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-KW" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + " د.ك";

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); }}
        className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
      >
        <Wallet size={15} />
        {locale === "ar" ? "تسجيل إيداع" : "Record Deposit"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">تسجيل إيداع في المحفظة</h2>
                <p className="text-xs text-muted-foreground">{driverName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-5">
              {/* رصيد حالي */}
              <div className="rounded-lg bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الرصيد الحالي مع السائق</span>
                  <span className={`number font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    {fmtKWD(balance)}
                  </span>
                </div>
                {amount && Number(amount) > 0 && (
                  <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">الرصيد بعد الإيداع</span>
                    <span className={`number font-bold ${remaining > 0 ? "text-red-600" : remaining < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                      {fmtKWD(remaining)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    المبلغ (د.ك) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field w-full"
                    dir="ltr"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">التاريخ</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input-field w-full"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">الوصف</label>
                <input
                  type="text"
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  className="input-field w-full"
                  placeholder="إيداع محفظة سائق"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isBankDeposit}
                  onChange={(e) => setIsBankDeposit(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                إيداع بنكي
              </label>

              {isBankDeposit && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    البنك <span className="text-red-500">*</span>
                  </label>
                  {loadingBanks ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      جاري التحميل...
                    </div>
                  ) : banks.length === 0 ? (
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                      ⚠️ لا توجد بنوك. أضف بنك من إعدادات المحاسبة.
                    </div>
                  ) : (
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="input-field w-full"
                    >
                      {banks.map((bank) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.nameAr} - {bank.bankName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                  {saving ? "جاري الحفظ..." : "تسجيل الإيداع"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
