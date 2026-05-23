"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Investor { id: string; nameAr: string }
interface Branch { id: string; nameAr: string }
interface BankAccount { id: string; nameAr: string; bankName: string }
interface Collection {
  id: string;
  month: number;
  year: number;
  collectedAmount: string;
  collectedDate: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  investor: { nameAr: string };
}

const STATUS_LABELS: Record<string, string> = {
  COLLECTED: "محصل",
  PARTIALLY_DISBURSED: "مصروف جزئياً",
  FULLY_DISBURSED: "مصروف بالكامل",
};

const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const now = new Date();
const EMPTY = {
  investorId: "", branchId: "", month: now.getMonth() + 1,
  year: now.getFullYear(), collectedAmount: "",
  collectedDate: now.toISOString().slice(0, 10),
  bankAccountId: "", notes: "",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function InvestorSalariesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c, d] = await Promise.all([
      fetch(`/api/investors/salary-collections?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((r) => r.json()),
    ]);
    if (a.success) setCollections(a.data);
    if (b.success) setInvestors(b.data);
    if (c.success) setBranches(c.data);
    if (d.success) setBankAccounts(d.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function f<K extends keyof typeof EMPTY>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function save() {
    if (!form.investorId) { setFormError("اختر المستثمر"); return; }
    if (!form.collectedAmount || Number(form.collectedAmount) <= 0) { setFormError("أدخل مبلغاً صحيحاً"); return; }
    setSaving(true); setFormError("");
    const body = {
      companyId,
      investorId: form.investorId,
      branchId: form.branchId || undefined,
      month: Number(form.month),
      year: Number(form.year),
      collectedAmount: Number(form.collectedAmount),
      collectedDate: form.collectedDate,
      bankAccountId: form.bankAccountId || undefined,
      notes: form.notes || undefined,
    };
    const res = await fetch("/api/investors/salary-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  const total = collections.reduce((s, c) => s + Number(c.collectedAmount), 0);
  const pending = collections.filter((c) => c.status === "COLLECTED").length;

  return (
    <div>
      <Header
        title="رواتب المستثمرين"
        subtitle="دورات تحصيل رواتب موظفي المستثمرين"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setForm(EMPTY); setFormError(""); setShowForm(true); }}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            + تسجيل تحصيل
          </button>
        }
      />
      <div className="page-container space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي المحصل</p>
            <p className="number mt-1 text-xl font-bold">{total.toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">سجلات التحصيل</p>
            <p className="mt-1 text-2xl font-bold">{collections.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">بانتظار الصرف</p>
            <p className={`mt-1 text-2xl font-bold ${pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{pending}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>المستثمر</th>
                    <th>الفترة</th>
                    <th>المبلغ المحصل</th>
                    <th>تاريخ التحصيل</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">لا توجد تحصيلات — اضغط "تسجيل تحصيل"</td></tr>
                  ) : collections.map((col) => (
                    <tr key={col.id} className="hover:bg-muted/30">
                      <td className="font-medium">{col.investor.nameAr}</td>
                      <td>{MONTHS[col.month - 1]} {col.year}</td>
                      <td className="number font-bold text-green-600">
                        {Number(col.collectedAmount).toLocaleString("ar-KW", { minimumFractionDigits: 3 })} د.ك
                      </td>
                      <td className="text-sm">{new Date(col.collectedDate).toLocaleDateString("ar-KW")}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          col.status === "FULLY_DISBURSED" ? "bg-green-100 text-green-700" :
                          col.status === "PARTIALLY_DISBURSED" ? "bg-yellow-100 text-yellow-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {STATUS_LABELS[col.status] ?? col.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="تسجيل تحصيل رواتب مستثمر" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">المستثمر *</label>
              <select className="input-field" value={form.investorId} onChange={f("investorId")}>
                <option value="">— اختر المستثمر —</option>
                {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">الفرع (اختياري)</label>
              <select className="input-field" value={form.branchId} onChange={f("branchId")}>
                <option value="">— بدون فرع —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الشهر</label>
                <select className="input-field" value={form.month} onChange={f("month")}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">السنة</label>
                <input type="number" className="input-field" value={form.year} onChange={f("year")} min={2020} max={2100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">المبلغ المحصل (د.ك) *</label>
                <input type="number" step="0.001" min="0" className="input-field" value={form.collectedAmount} onChange={f("collectedAmount")} />
              </div>
              <div>
                <label className="form-label">تاريخ التحصيل *</label>
                <input type="date" className="input-field" value={form.collectedDate} onChange={f("collectedDate")} />
              </div>
            </div>
            <div>
              <label className="form-label">الحساب البنكي (اختياري)</label>
              <select className="input-field" value={form.bankAccountId} onChange={f("bankAccountId")}>
                <option value="">— نقدي —</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.nameAr} — {b.bankName}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={f("notes")} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "تسجيل"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
