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

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  bankName: string;
}

const now = new Date();
const EMPTY = {
  driverId: "",
  amount: "",
  date: now.toISOString().slice(0, 10),
  isBankDeposit: false,
  bankAccountId: "",
  descriptionAr: "",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
    bankAccount: en ? "Bank account *" : "الحساب البنكي *",
    chooseBank: en ? "— Select bank account —" : "— اختر الحساب البنكي —",
    bankRequired: en ? "Select the bank account for the deposit" : "اختر الحساب البنكي للإيداع",
    cancel: en ? "Cancel" : "إلغاء",
    saving: en ? "Saving..." : "جاري الحفظ...",
    saveDeposit: en ? "Register deposit" : "تسجيل الإيداع",
    settleConfirm: (name: string, bal: string) => en
      ? `Settle and zero ${name}'s balance (${bal} KWD)? A documented settlement movement will be recorded.`
      : `تسوية وتصفير رصيد ${name} (${bal} د.ك)؟ سيتم تسجيل حركة تسوية موثّقة.`,
    settleFailed: en ? "Settlement failed" : "فشل في التسوية",
    genericError: en ? "An error occurred" : "حدث خطأ",
    reconciliation: en ? "Wallet reconciliation" : "توفيق المحافظ",
    showRecon: en ? "Reconciliation" : "التوفيق",
    collected: en ? "Collected" : "المحصّل",
    deposited: en ? "Deposited" : "المودَع",
    otherAdj: en ? "Settlements/Other" : "تسويات/أخرى",
    remaining: en ? "Remaining" : "المتبقّي",
    reconNote: en
      ? "Remaining = Collected − Deposited − Settlements/Other. The total should equal GL account 1030 (Driver wallet receivables)."
      : "المتبقّي = المحصّل − المودَع − تسويات/أخرى. والإجمالي يجب أن يساوي رصيد حساب 1030 (ذمم محافظ السائقين).",
    postCharges: en ? "Post collections to ledger (2031)" : "ترحيل التحصيلات للأستاذ (2031)",
    dedupe: en ? "Remove duplicate charges" : "إزالة الحركات المكرّرة",
    dedupeTitle: en ? "Remove duplicate collection charges" : "إزالة حركات التحصيل المكرّرة",
    dedupeIntro: en
      ? "Duplicate collection (CHARGE) movements caused by re-saving daily orders will be removed, then balances are recomputed to match the daily orders. Distributions and deposits are not touched."
      : "هتتشال حركات التحصيل (CHARGE) المكرّرة الناتجة عن إعادة حفظ الطلبات اليومية، وبعدها تتعاد الأرصدة لتطابق الطلبات اليومية. التوزيعات والإيداعات مش بتتمس.",
    dedupePreview: (n: number, amt: string, drv: number) => en
      ? `Found ${n} duplicate charge(s) totaling ${amt} KWD across ${drv} driver(s).`
      : `تم العثور على ${n} حركة مكرّرة بإجمالي ${amt} د.ك لدى ${drv} سائق.`,
    dedupeNone: en ? "No duplicate charges found." : "لا توجد حركات مكرّرة.",
    dedupeDone: (n: number) => en ? `Removed ${n} duplicate charge(s) and recomputed balances.` : `تم حذف ${n} حركة مكرّرة وإعادة حساب الأرصدة.`,
    fixOldDeposits: en ? "Fix old deposits' bank" : "تصحيح بنك الإيداعات القديمة",
    fixTitle: en ? "Reclassify old bank deposits" : "تصحيح بنك الإيداعات القديمة",
    fixIntro: en
      ? "Old bank deposits posted to the general bank (1010) will be moved to the selected bank account (amounts are unchanged)."
      : "الإيداعات البنكية القديمة المرحّلة على البنك العام (1010) هتتنقل لحساب البنك المختار (المبالغ مش هتتغيّر).",
    apply: en ? "Apply" : "تطبيق",
    applying: en ? "Applying..." : "جاري التطبيق...",
  };
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<{ driverId: string; type: string; amount: number }[]>([]);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [showRecon, setShowRecon] = useState(false);
  const [showReclass, setShowReclass] = useState(false);
  const [reclassBank, setReclassBank] = useState("");
  const [reclassMsg, setReclassMsg] = useState("");
  const [reclassing, setReclassing] = useState(false);
  const [showDedupe, setShowDedupe] = useState(false);
  const [dedupeMsg, setDedupeMsg] = useState("");
  const [dedupeBusy, setDedupeBusy] = useState(false);
  const [dedupeCount, setDedupeCount] = useState<number | null>(null);
  const [postBusy, setPostBusy] = useState(false);
  const [postMsg, setPostMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const walletQuery = new URLSearchParams({
      companyId,
      ...(month ? { month } : {}),
      ...(year ? { year } : {}),
    });
    const [d, t, b] = await Promise.all([
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/wallet?${walletQuery}`).then((r) => r.json()).catch(() => ({ success: false })),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((r) => r.json()).catch(() => ({ success: false })),
    ]);
    if (d.success) setDrivers(d.data);
    if (t.success && Array.isArray(t.data?.transactions)) setTransactions(t.data.transactions);
    if (t.success && Array.isArray(t.data?.summary)) setSummary(t.data.summary);
    if (b.success && Array.isArray(b.data)) setBankAccounts(b.data);
    setLoading(false);
  }, [companyId, month, year]);

  async function reclassifyOldDeposits() {
    if (!reclassBank) return;
    setReclassing(true); setReclassMsg("");
    const res = await fetch("/api/delivery/wallet/reclassify-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, bankAccountId: reclassBank }),
    });
    const data = await res.json();
    setReclassing(false);
    if (!data.success) { setReclassMsg(data.error ?? t.genericError); return; }
    setReclassMsg(en ? `Reclassified ${data.reclassified} deposit(s).` : `تم تصحيح ${data.reclassified} إيداع.`);
    load();
  }

  async function previewDedupe() {
    setShowDedupe(true); setDedupeBusy(true); setDedupeMsg(""); setDedupeCount(null);
    const res = await fetch("/api/delivery/wallet/dedupe-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, apply: false }),
    });
    const data = await res.json();
    setDedupeBusy(false);
    if (!data.success) { setDedupeMsg(data.error ?? t.genericError); return; }
    setDedupeCount(data.duplicates);
    setDedupeMsg(data.duplicates > 0
      ? t.dedupePreview(data.duplicates, Number(data.duplicateAmount).toLocaleString(numberLocale, { minimumFractionDigits: 3 }), data.affectedDrivers)
      : t.dedupeNone);
  }

  async function applyDedupe() {
    setDedupeBusy(true); setDedupeMsg("");
    const res = await fetch("/api/delivery/wallet/dedupe-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, apply: true }),
    });
    const data = await res.json();
    setDedupeBusy(false);
    if (!data.success) { setDedupeMsg(data.error ?? t.genericError); return; }
    setDedupeCount(0);
    setDedupeMsg(t.dedupeDone(data.removed));
    load();
  }

  async function postCharges() {
    setPostBusy(true); setPostMsg("");
    try {
      const pre = await fetch("/api/delivery/wallet/post-charges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, apply: false }),
      });
      const p = await pre.json();
      if (!p.success) { setPostMsg(p.error ?? t.genericError); return; }
      const ok = window.confirm(en
        ? `Create ${p.created}, update ${p.updated}, remove ${p.removed} ledger entries for collections. Continue?`
        : `إنشاء ${p.created} قيد، تحديث ${p.updated}، حذف ${p.removed} — لترحيل التحصيلات لأمانات طلبات (2031). متابعة؟`);
      if (!ok) { setPostMsg(""); return; }
      const res = await fetch("/api/delivery/wallet/post-charges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, apply: true }),
      });
      const data = await res.json();
      if (!data.success) { setPostMsg(data.error ?? t.genericError); return; }
      setPostMsg(en
        ? `Done: ${data.created} created, ${data.updated} updated, ${data.removed} removed.`
        : `تم: ${data.created} إنشاء، ${data.updated} تحديث، ${data.removed} حذف.`);
      load();
    } finally {
      setPostBusy(false);
    }
  }

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
    if (form.isBankDeposit && !form.bankAccountId) { setFormError(t.bankRequired); return; }
    setSaving(true); setFormError("");
    const res = await fetch("/api/delivery/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        driverId: form.driverId,
        amount: Number(form.amount),
        date: form.date,
        isBankDeposit: form.isBankDeposit,
        paymentMethod: form.isBankDeposit ? "BANK" : "CASH",
        bankAccountId: form.isBankDeposit ? form.bankAccountId : null,
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

  // بيانات التوفيق: لكل سائق المحصّل (CHARGE) والمودَع (DEPOSIT)، والباقي يُحسب
  const reconByDriver = new Map<string, { collected: number; deposited: number }>();
  for (const s of summary) {
    const e = reconByDriver.get(s.driverId) ?? { collected: 0, deposited: 0 };
    if (s.type === "CHARGE") e.collected += s.amount;
    if (s.type === "DEPOSIT") e.deposited += s.amount;
    reconByDriver.set(s.driverId, e);
  }
  const reconTotals = drivers.reduce(
    (acc, d) => {
      const r = reconByDriver.get(d.id) ?? { collected: 0, deposited: 0 };
      const bal = Number(d.walletBalance);
      acc.collected += r.collected;
      acc.deposited += r.deposited;
      acc.balance += bal;
      acc.other += r.collected - r.deposited - bal;
      return acc;
    },
    { collected: 0, deposited: 0, other: 0, balance: 0 },
  );

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
          <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecon((v) => !v)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            {t.showRecon}
          </button>
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + {t.registerDeposit}
          </button>
          </div>
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

        {showRecon && !loading && (
          <div className="section-card overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{t.reconciliation}</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={postCharges}
                  disabled={postBusy}
                  className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {t.postCharges}
                </button>
                <button
                  onClick={previewDedupe}
                  className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                >
                  {t.dedupe}
                </button>
                <button
                  onClick={() => { setReclassBank(""); setReclassMsg(""); setShowReclass(true); }}
                  className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {t.fixOldDeposits}
                </button>
              </div>
            </div>
            <p className="mb-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{t.reconNote}</p>
            {postMsg && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{postMsg}</p>}
            <div className="overflow-x-auto">
              <table className="ar-table text-sm">
                <thead>
                  <tr>
                    <th>{t.driver}</th>
                    <th className="text-left">{t.collected}</th>
                    <th className="text-left">{t.deposited}</th>
                    <th className="text-left">{t.otherAdj}</th>
                    <th className="text-left">{t.remaining}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDrivers.map((d) => {
                    const r = reconByDriver.get(d.id) ?? { collected: 0, deposited: 0 };
                    const bal = Number(d.walletBalance);
                    const other = r.collected - r.deposited - bal;
                    return (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="font-medium">{d.employee.nameAr}</td>
                        <td className="number text-left">{r.collected.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                        <td className="number text-left text-green-600">{r.deposited.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                        <td className="number text-left text-muted-foreground">{other.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                        <td className={`number text-left font-bold ${bal < 0 ? "text-red-600" : "text-blue-600"}`}>{bal.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td>{t.totalBalances}</td>
                    <td className="number text-left">{reconTotals.collected.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                    <td className="number text-left text-green-600">{reconTotals.deposited.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                    <td className="number text-left">{reconTotals.other.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                    <td className="number text-left">{reconTotals.balance.toLocaleString(numberLocale, { minimumFractionDigits: 3 })} {kwd}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

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
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <h2 className="flex-1 text-base font-bold">{t.recentMovements}</h2>
                <div className="flex gap-2">
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-28 text-sm">
                    <option value="">{en ? "All" : "الكل"}</option>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-28 text-sm">
                    <option value="">{en ? "All" : "الكل"}</option>
                    <option value="1">{en ? "Jan" : "يناير"}</option>
                    <option value="2">{en ? "Feb" : "فبراير"}</option>
                    <option value="3">{en ? "Mar" : "مارس"}</option>
                    <option value="4">{en ? "Apr" : "أبريل"}</option>
                    <option value="5">{en ? "May" : "مايو"}</option>
                    <option value="6">{en ? "Jun" : "يونيو"}</option>
                    <option value="7">{en ? "Jul" : "يوليو"}</option>
                    <option value="8">{en ? "Aug" : "أغسطس"}</option>
                    <option value="9">{en ? "Sep" : "سبتمبر"}</option>
                    <option value="10">{en ? "Oct" : "أكتوبر"}</option>
                    <option value="11">{en ? "Nov" : "نوفمبر"}</option>
                    <option value="12">{en ? "Dec" : "ديسمبر"}</option>
                  </select>
                </div>
              </div>
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
                onChange={(e) => setForm((p) => ({ ...p, isBankDeposit: e.target.checked, bankAccountId: e.target.checked ? p.bankAccountId : "" }))} className="h-4 w-4" />
              <label htmlFor="isBankDep" className="text-sm">{t.bankDeposit}</label>
            </div>
            {form.isBankDeposit && (
              <div>
                <label className="form-label">{t.bankAccount}</label>
                <select className="input-field" value={form.bankAccountId}
                  onChange={(e) => setForm((p) => ({ ...p, bankAccountId: e.target.value }))}>
                  <option value="">{t.chooseBank}</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(en ? b.nameEn ?? b.nameAr : b.nameAr)}{b.bankName ? ` — ${b.bankName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

      {showReclass && (
        <Modal title={t.fixTitle} onClose={() => setShowReclass(false)}>
          <div className="space-y-3">
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{t.fixIntro}</p>
            <div>
              <label className="form-label">{t.bankAccount}</label>
              <select className="input-field" value={reclassBank} onChange={(e) => setReclassBank(e.target.value)}>
                <option value="">{t.chooseBank}</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(en ? b.nameEn ?? b.nameAr : b.nameAr)}{b.bankName ? ` — ${b.bankName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {reclassMsg && <p className="rounded-lg bg-blue-50 p-2 text-sm text-blue-700">{reclassMsg}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowReclass(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              <button onClick={reclassifyOldDeposits} disabled={reclassing || !reclassBank} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {reclassing ? t.applying : t.apply}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDedupe && (
        <Modal title={t.dedupeTitle} onClose={() => setShowDedupe(false)}>
          <div className="space-y-3">
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{t.dedupeIntro}</p>
            {dedupeBusy ? (
              <p className="text-sm text-muted-foreground">{t.applying}</p>
            ) : (
              dedupeMsg && <p className={`rounded-lg p-2 text-sm ${dedupeCount === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{dedupeMsg}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDedupe(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              {dedupeCount != null && dedupeCount > 0 && (
                <button onClick={applyDedupe} disabled={dedupeBusy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {dedupeBusy ? t.applying : t.apply}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
