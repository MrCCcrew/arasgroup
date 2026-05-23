"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Wallet, X } from "lucide-react";
import { Header } from "@/components/layout/header";

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

const TX_LABELS: Record<string, string> = {
  CHARGE: "شحن من المنصة",
  DEPOSIT: "إيداع من السائق",
  SETTLEMENT: "تسوية",
  DEDUCTION: "خصم",
  INCENTIVE: "حافز",
  DEDUCTION_PENALTY: "غرامة",
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [d, t] = await Promise.all([
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/wallet?driverId=all&companyId=${companyId}`).then((r) => r.json()).catch(() => ({ success: false })),
    ]);
    if (d.success) setDrivers(d.data);
    if (t.success && Array.isArray(t.data?.transactions)) setTransactions(t.data.transactions);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.driverId) { setFormError("اختر السائق"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError("أدخل مبلغاً صحيحاً"); return; }
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
        descriptionAr: form.descriptionAr || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  const totalBalance = drivers.reduce((s, d) => s + Number(d.walletBalance), 0);
  const negativeCount = drivers.filter((d) => Number(d.walletBalance) < 0).length;

  return (
    <div>
      <Header
        title="محافظ السائقين"
        subtitle="أرصدة وحركات محافظ السائقين"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + تسجيل إيداع
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
                {totalBalance.toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك
              </p>
              <p className="text-xs text-muted-foreground">إجمالي الأرصدة</p>
            </div>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold">{drivers.length}</p>
            <p className="text-xs text-muted-foreground">سائق</p>
          </div>
          <div className="stat-card">
            <p className={`text-2xl font-bold ${negativeCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{negativeCount}</p>
            <p className="text-xs text-muted-foreground">رصيد سالب</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-base font-bold">أرصدة السائقين</h2>
              <div className="space-y-2">
                {drivers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">لا يوجد سائقون</p>
                ) : drivers.map((d) => {
                  const balance = Number(d.walletBalance);
                  return (
                    <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <span className="text-sm font-medium">{d.employee.nameAr}</span>
                      <span className={`number text-sm font-bold ${balance < 0 ? "text-red-600" : balance > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                        {balance.toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section-card">
              <h2 className="mb-4 text-base font-bold">آخر الحركات</h2>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">لا توجد حركات</p>
                ) : transactions.slice(0, 20).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">{tx.driver.employee.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{TX_LABELS[tx.type] ?? tx.type}</p>
                    </div>
                    <div className="text-left">
                      <p className={`number text-sm font-bold ${tx.type === "DEPOSIT" ? "text-green-600" : "text-blue-600"}`}>
                        {Number(tx.amount).toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("ar-KW")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="تسجيل إيداع في المحفظة" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">السائق *</label>
              <select className="input-field" value={form.driverId} onChange={(e) => setForm((p) => ({ ...p, driverId: e.target.value }))}>
                <option value="">— اختر السائق —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee.nameAr} ({Number(d.walletBalance).toFixed(3)} د.ك)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">المبلغ (د.ك) *</label>
                <input type="number" step="0.001" min="0" className="input-field" value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">التاريخ *</label>
                <input type="date" className="input-field" value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">الوصف</label>
              <input className="input-field" value={form.descriptionAr}
                onChange={(e) => setForm((p) => ({ ...p, descriptionAr: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isBankDep" checked={form.isBankDeposit}
                onChange={(e) => setForm((p) => ({ ...p, isBankDeposit: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="isBankDep" className="text-sm">إيداع بنكي</label>
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "تسجيل الإيداع"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
