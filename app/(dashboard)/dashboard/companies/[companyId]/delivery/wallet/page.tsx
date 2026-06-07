"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Wallet, X, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Driver {
  id: string;
  walletBalance: string;
  employee: { nameAr: string };
}
interface Transaction {
  id: string;
  type: string;
  amount: string;
  date: string;
  descriptionAr?: string | null;
  driver: { employee: { nameAr: string } };
}

const TX_LABELS: Record<string, { ar: string; en: string }> = {
  CHARGE: { ar: "شحن من المنصة", en: "Platform charge" },
  DEPOSIT: { ar: "إيداع من السائق", en: "Driver deposit" },
  SETTLEMENT: { ar: "تسوية", en: "Settlement" },
  DEDUCTION: { ar: "خصم", en: "Deduction" },
  INCENTIVE: { ar: "حافز", en: "Incentive" },
  DEDUCTION_PENALTY: { ar: "غرامة", en: "Penalty" },
};

const now = new Date();
const EMPTY = {
  driverId: "",
  amount: "",
  date: now.toISOString().slice(0, 10),
  isBankDeposit: false,
  descriptionAr: "",
};

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

export default function WalletPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const kwd = en ? "KWD" : "د.ك";
  const t = {
    title: en ? "Driver Wallets" : "محافظ السائقين",
    subtitle: en ? "Driver wallet balances and movements" : "أرصدة وحركات محافظ السائقين",
    registerDeposit: en ? "Register deposit" : "تسجيل إيداع",
    totalBalances: en ? "Total balances" : "إجمالي الأرصدة",
    driver: en ? "Driver" : "سائق",
    negativeBalance: en ? "Negative balance" : "رصيد سالب",
    loading: en ? "Loading..." : "جاري التحميل...",
    balances: en ? "Driver balances" : "أرصدة السائقين",
    noDrivers: en ? "No drivers" : "لا يوجد سائقون",
    settle: en ? "Settle" : "تسوية",
    recentMovements: en ? "Recent movements" : "آخر الحركات",
    noMovements: en ? "No movements" : "لا توجد حركات",
    deleteMovementTitle: en ? "Delete movement" : "حذف الحركة",
    confirmDeleteTx: en ? "Delete this movement? The amount will be reversed on the driver's balance." : "حذف هذه الحركة؟ سيتم عكس المبلغ على رصيد السائق.",
    deleteFailed: en ? "Delete failed" : "فشل الحذف",
    depositModal: en ? "Register a wallet deposit" : "تسجيل إيداع في المحفظة",
    chooseDriver: en ? "— Select driver —" : "— اختر السائق —",
    driverRequired: en ? "Select a driver" : "اختر السائق",
    amountInvalid: en ? "Enter a valid amount" : "أدخل مبلغاً صحيحاً",
    amountLabel: en ? "Amount (KWD) *" : "المبلغ (د.ك) *",
    dateLabel: en ? "Date *" : "التاريخ *",
    description: en ? "Description" : "الوصف",
    bankDeposit: en ? "Bank deposit" : "إيداع بنكي",
    cancel: en ? "Cancel" : "إلغاء",
    saving: en ? "Saving..." : "جاري الحفظ...",
    saveDeposit: en ? "Register deposit" : "تسجيل الإيداع",
    settleConfirm: (name: string, bal: string) => en
      ? `Settle and zero ${name}'s balance (${bal} KWD)? A documented settlement movement will be recorded.`
      : `تسوية وتصفير رصيد ${name} (${bal} د.ك)؟ سيتم تسجيل حركة تسوية موثّقة.`,
    settleFailed: en ? "Settlement failed" : "فشل في التسوية",
    genericError: en ? "An error occurred" : "حدث خطأ",
  };
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, t] = await Promise.all([
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/wallet?companyId=${companyId}`).then((r) => r.json()).catch(() => ({ success: false })),
    ]);
    if (d.success) setDrivers(d.data);
    if (t.success && Array.isArray(t.data?.transactions)) setTransactions(t.data.transactions);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function settleBalance(driverId: string, name: string, balance: number) {
    if (!confirm(t.settleConfirm(name, balance.toFixed(3)))) return;
    setSettlingId(driverId);
    const res = await fetch("/api/delivery/wallet/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, companyId }),
    });
    const data = await res.json();
    setSettlingId(null);
    if (data.success) load();
    else alert(data.error ?? t.settleFailed);
  }

  async function save() {
    if (!form.driverId) { setFormError(t.driverRequired); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError(t.amountInvalid); return; }
    setSaving(true); setFormError("");
    const res = await fetch("/api/delivery/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        driverId: form.driverId,
        amount: Number(form.amount),
        date: form.date,
        paymentMethod: form.isBankDeposit ? "BANK" : "CASH",
        descriptionAr: form.descriptionAr || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? t.genericError); return; }
    setShowForm(false);
    load();
  }

  const totalBalance = drivers.reduce((s, d) => s + Number(d.walletBalance), 0);
  const negativeCount = drivers.filter((d) => Number(d.walletBalance) < 0).length;

  // نرتّب الأرصدة: غير الصفرية أولاً (الأكثر سالبية في الأعلى) ثم الصفرية،
  // حتى يظهر صاحب الرصيد السالب مباشرةً بدل أن يكون مدفوناً أبجدياً.
  const sortedDrivers = [...drivers].sort((a, b) => {
    const ba = Number(a.walletBalance);
    const bb = Number(b.walletBalance);
    const za = ba === 0 ? 1 : 0;
    const zb = bb === 0 ? 1 : 0;
    if (za !== zb) return za - zb;
    return ba - bb;
  });

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
            + {t.registerDeposit}
          </button>
        }
      />
      <div className="page-container space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Wallet size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="number text-xl font-bold">
                {totalBalance.toLocaleString(numberLocale, { minimumFractionDigits: 3 })} {kwd}
              </p>
              <p className="text-xs text-muted-foreground">{t.totalBalances}</p>
            </div>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold">{drivers.length}</p>
            <p className="text-xs text-muted-foreground">{t.driver}</p>
          </div>
          <div className="stat-card">
            <p className={`text-2xl font-bold ${negativeCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{negativeCount}</p>
            <p className="text-xs text-muted-foreground">{t.negativeBalance}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{t.loading}</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-base font-bold">{t.balances}</h2>
              <div className="space-y-2">
                {sortedDrivers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t.noDrivers}</p>
                ) : sortedDrivers.map((d) => {
                  const balance = Number(d.walletBalance);
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <span className="text-sm font-medium">{d.employee.nameAr}</span>
                      <div className="flex items-center gap-3">
                        <span className={`number text-sm font-bold ${balance < 0 ? "text-red-600" : balance > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                          {balance.toLocaleString(numberLocale, { minimumFractionDigits: 3 })} {kwd}
                        </span>
                        {balance > 0 && (
                          <button
                            onClick={() => settleBalance(d.id, d.employee.nameAr, balance)}
                            disabled={settlingId === d.id}
                            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                            title={t.settle}
                          >
                            {settlingId === d.id ? "..." : t.settle}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section-card">
              <h2 className="mb-4 text-base font-bold">{t.recentMovements}</h2>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t.noMovements}</p>
                ) : transactions.slice(0, 20).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">{tx.driver.employee.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{(TX_LABELS[tx.type] && (en ? TX_LABELS[tx.type].en : TX_LABELS[tx.type].ar)) ?? tx.type}</p>
                      {tx.descriptionAr && <p className="text-xs text-muted-foreground">{tx.descriptionAr}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className={`number text-sm font-bold ${tx.type === "DEPOSIT" ? "text-green-600" : "text-blue-600"}`}>
                          {Number(tx.amount).toLocaleString(numberLocale, { minimumFractionDigits: 3 })} {kwd}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString(numberLocale)}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(t.confirmDeleteTx)) return;
                          const res = await fetch(`/api/delivery/wallet/${tx.id}`, { method: "DELETE" });
                          const data = await res.json();
                          if (data.success) load();
                          else alert(data.error ?? t.deleteFailed);
                        }}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        title={t.deleteMovementTitle}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title={t.depositModal} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">{t.driver} *</label>
              <select className="input-field" value={form.driverId} onChange={(e) => setForm((p) => ({ ...p, driverId: e.target.value }))}>
                <option value="">{t.chooseDriver}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee.nameAr} ({Number(d.walletBalance).toFixed(3)} {kwd})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t.amountLabel}</label>
                <input type="number" step="0.001" min="0" className="input-field" value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">{t.dateLabel}</label>
                <input type="date" className="input-field" value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">{t.description}</label>
              <input className="input-field" value={form.descriptionAr}
                onChange={(e) => setForm((p) => ({ ...p, descriptionAr: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isBankDep" checked={form.isBankDeposit}
                onChange={(e) => setForm((p) => ({ ...p, isBankDeposit: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="isBankDep" className="text-sm">{t.bankDeposit}</label>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? t.saving : t.saveDeposit}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
