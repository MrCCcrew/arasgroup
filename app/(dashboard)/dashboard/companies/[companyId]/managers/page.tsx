"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

type ChargeType = "RENT" | "EXPENSE" | "REVENUE";
type Tab = ChargeType | "SALARY" | "REPORTS";

interface Investor {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}
interface Payment {
  id: string;
  amount: number;
  paidDate: string;
  notes: string | null;
}
interface Charge {
  id: string;
  investorId: string;
  investorName: string;
  type: ChargeType;
  title: string;
  month: number | null;
  year: number;
  amount: number;
  dueDate: string | null;
  notes: string | null;
  paid: number;
  remaining: number;
  payments: Payment[];
}
interface EmployeeOpt {
  id: string;
  nameAr: string;
  salary: number;
  licenseName: string | null;
}
interface SalaryLine {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
}
interface Batch {
  id: string;
  investorId: string;
  investorName: string;
  month: number;
  year: number;
  bankCommission: number;
  notes: string | null;
  salariesTotal: number;
  total: number;
  collected: number;
  remaining: number;
  lines: SalaryLine[];
  payments: Payment[];
}

const MONTHS_AR = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function ManagersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const numLoc = en ? "en-US" : "ar-KW";
  const money = (n: number) => `${n.toLocaleString(numLoc, { minimumFractionDigits: 3 })} ${en ? "KWD" : "د.ك"}`;
  const monthLabel = (m: number | null) => (m ? (en ? `M${m}` : MONTHS_AR[m]) : en ? "Annual" : "سنوي");

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [investorId, setInvestorId] = useState("");
  const [tab, setTab] = useState<Tab>("RENT");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/investors?companyId=${companyId}`)
      .then((r) => r.json())
      .then((p) => {
        if (p.success) {
          setInvestors(p.data);
          if (p.data.length > 0) setInvestorId(p.data[0].id);
        }
      });
  }, [companyId]);

  const loadCharges = useCallback(
    async (type: ChargeType) => {
      if (!investorId) return;
      setLoading(true);
      const res = await fetch(`/api/managers/charges?companyId=${companyId}&investorId=${investorId}&type=${type}`);
      const p = await res.json();
      if (p.success) setCharges(p.data);
      setLoading(false);
    },
    [companyId, investorId],
  );

  const loadBatches = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    const res = await fetch(`/api/managers/salary-batches?companyId=${companyId}&investorId=${investorId}`);
    const p = await res.json();
    if (p.success) setBatches(p.data);
    setLoading(false);
  }, [companyId, investorId]);

  useEffect(() => {
    if (tab === "RENT" || tab === "EXPENSE" || tab === "REVENUE") loadCharges(tab);
    else if (tab === "SALARY") loadBatches();
  }, [tab, investorId, loadCharges, loadBatches]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "RENT", label: en ? "Rents" : "الإيجارات" },
    { key: "EXPENSE", label: en ? "Expenses" : "المصاريف" },
    { key: "REVENUE", label: en ? "Revenue" : "الإيرادات" },
    { key: "SALARY", label: en ? "Salary collection" : "تحصيل الرواتب" },
    { key: "REPORTS", label: en ? "Reports" : "التقارير" },
  ];

  return (
    <div>
      <Header
        title={en ? "Officials & managers" : "إدارة المسئولين والمديرين"}
        subtitle={en ? "Reference-only billing — does not affect accounting" : "إدارة مرجعية — لا تؤثر على الحسابات نهائيًا"}
        companyId={companyId}
      />
      <div className="page-container space-y-4">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">{en ? "Official" : "المسئول"}</label>
          <select value={investorId} onChange={(e) => setInvestorId(e.target.value)} className="input-field w-full sm:w-72">
            <option value="">{en ? "Select..." : "اختر..."}</option>
            {investors.map((i) => (
              <option key={i.id} value={i.id}>{en ? i.nameEn ?? i.nameAr : i.nameAr}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 border-b">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === tb.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "REPORTS" ? (
          <ReportsLinks companyId={companyId} en={en} />
        ) : !investorId ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">{en ? "Select an official first." : "اختر مسئولاً أولاً."}</p>
        ) : tab === "SALARY" ? (
          <SalaryTab
            companyId={companyId}
            investorId={investorId}
            batches={batches}
            loading={loading}
            reload={loadBatches}
            setError={setError}
            money={money}
            monthLabel={monthLabel}
            en={en}
            numLoc={numLoc}
          />
        ) : (
          <ChargesTab
            companyId={companyId}
            investorId={investorId}
            type={tab}
            charges={charges}
            loading={loading}
            reload={() => loadCharges(tab)}
            setError={setError}
            money={money}
            monthLabel={monthLabel}
            en={en}
          />
        )}
      </div>
    </div>
  );
}

function ReportsLinks({ companyId, en }: { companyId: string; en: boolean }) {
  const links = [
    { href: `rents`, label: en ? "Rents statement" : "كشف الإيجارات" },
    { href: `expenses`, label: en ? "Expenses statement" : "كشف المصاريف" },
    { href: `revenue`, label: en ? "Revenue statement" : "كشف الإيرادات" },
    { href: `salaries`, label: en ? "Salaries statement" : "كشف الرواتب" },
    { href: `employees`, label: en ? "Per-employee statement" : "كشف لكل موظف" },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={`/dashboard/companies/${companyId}/managers/reports?view=${l.href}`}
          className="rounded-xl border bg-card p-4 text-sm font-medium hover:bg-muted"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function ChargesTab({
  companyId,
  investorId,
  type,
  charges,
  loading,
  reload,
  setError,
  money,
  monthLabel,
  en,
}: {
  companyId: string;
  investorId: string;
  type: ChargeType;
  charges: Charge[];
  loading: boolean;
  reload: () => void;
  setError: (s: string) => void;
  money: (n: number) => string;
  monthLabel: (m: number | null) => string;
  en: boolean;
}) {
  const now = new Date();
  const blank = { title: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()), amount: "", dueDate: "", notes: "" };
  const [form, setForm] = useState({ ...blank });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredCharges = useMemo(() => {
    if (!search.trim()) return charges;
    const q = search.toLowerCase();
    return charges.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.investorName.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
    );
  }, [charges, search]);

  const paginatedCharges = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCharges.slice(start, start + itemsPerPage);
  }, [filteredCharges, currentPage]);

  const totalPages = Math.ceil(filteredCharges.length / itemsPerPage);

  const totals = useMemo(() => {
    const due = filteredCharges.reduce((s, c) => s + c.amount, 0);
    const paid = filteredCharges.reduce((s, c) => s + c.paid, 0);
    return { due, paid, remaining: due - paid };
  }, [filteredCharges]);

  function openAdd() {
    setEditId(null);
    setForm({ ...blank });
    setShowForm(true);
  }
  function openEdit(c: Charge) {
    setEditId(c.id);
    setForm({
      title: c.title,
      month: c.month ? String(c.month) : "",
      year: String(c.year),
      amount: String(c.amount),
      dueDate: c.dueDate ? c.dueDate.slice(0, 10) : "",
      notes: c.notes ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim() || !form.amount) {
      setError(en ? "Title and amount are required" : "البيان والمبلغ مطلوبان");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        title: form.title.trim(),
        month: form.month ? Number(form.month) : null,
        year: Number(form.year),
        amount: Number(form.amount),
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      };
      const res = await fetch(editId ? `/api/managers/charges/${editId}` : "/api/managers/charges", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? body : { ...body, companyId, investorId, type }),
      });
      const p = await res.json();
      if (!p.success) throw new Error(p.error);
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm(en ? "Delete this item and its collections?" : "حذف هذا المستحق وتحصيلاته؟")) return;
    const res = await fetch(`/api/managers/charges/${id}`, { method: "DELETE" });
    const p = await res.json();
    if (!p.success) { setError(p.error); return; }
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="rounded-xl border bg-card p-4">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-field w-full pr-8 text-sm"
            placeholder={en ? "Search by title, investor, or notes..." : "بحث بالبيان، المسئول، أو ملاحظات..."}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setCurrentPage(1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>{en ? "Due: " : "المستحق: "}<b>{money(totals.due)}</b></span>
          <span className="text-emerald-600">{en ? "Paid: " : "المدفوع: "}<b>{money(totals.paid)}</b></span>
          <span className={totals.remaining > 0 ? "text-red-600" : "text-muted-foreground"}>{en ? "Remaining: " : "المتبقي: "}<b>{money(totals.remaining)}</b></span>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={15} /> {en ? "Add" : "إضافة"}
        </button>
      </div>

      {showForm && (
        <div className="section-card grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <label className="mb-1 block text-xs font-medium">{en ? "Title *" : "البيان *"}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{en ? "Month" : "الشهر"}</label>
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="input-field w-full text-sm">
              <option value="">{en ? "Annual" : "سنوي"}</option>
              {MONTHS_AR.slice(1).map((m, i) => (<option key={i + 1} value={i + 1}>{en ? `M${i + 1}` : m}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{en ? "Year *" : "السنة *"}</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{en ? "Amount *" : "المبلغ *"}</label>
            <input type="number" step="0.001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{en ? "Due date" : "تاريخ الاستحقاق"}</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "..." : en ? "Save" : "حفظ"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Cancel" : "إلغاء"}</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="ar-table text-sm">
          <thead>
            <tr>
              <th>{en ? "Period" : "الفترة"}</th>
              <th>{en ? "Title" : "البيان"}</th>
              <th className="text-end">{en ? "Amount" : "المستحق"}</th>
              <th className="text-end">{en ? "Paid" : "المدفوع"}</th>
              <th className="text-end">{en ? "Remaining" : "المتبقي"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">...</td></tr>
            ) : filteredCharges.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{en ? "No items found" : "لا توجد نتائج"}</td></tr>
            ) : (
              paginatedCharges.map((c) => (
                <ChargeRow key={c.id} charge={c} expanded={expanded === c.id} toggle={() => setExpanded(expanded === c.id ? null : c.id)} reload={reload} setError={setError} money={money} monthLabel={monthLabel} onEdit={() => openEdit(c)} onDelete={() => del(c.id)} en={en} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">
            {en
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredCharges.length)} of ${filteredCharges.length}`
              : `عرض ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredCharges.length)} من ${filteredCharges.length}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
              {en ? "Previous" : "السابق"}
            </button>
            <span className="text-sm font-medium">
              {en ? `Page ${currentPage} of ${totalPages}` : `صفحة ${currentPage} من ${totalPages}`}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {en ? "Next" : "التالي"}
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChargeRow({
  charge, expanded, toggle, reload, setError, money, monthLabel, onEdit, onDelete, en,
}: {
  charge: Charge; expanded: boolean; toggle: () => void; reload: () => void; setError: (s: string) => void;
  money: (n: number) => string; monthLabel: (m: number | null) => string; onEdit: () => void; onDelete: () => void; en: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function addPayment() {
    if (!amount) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/managers/charges/${charge.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), paidDate, notes: null }),
      });
      const p = await res.json();
      if (!p.success) throw new Error(p.error);
      setAmount("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل");
    } finally {
      setBusy(false);
    }
  }
  async function delPayment(id: string) {
    const res = await fetch(`/api/managers/payments/${id}`, { method: "DELETE" });
    const p = await res.json();
    if (!p.success) { setError(p.error); return; }
    reload();
  }

  return (
    <>
      <tr className="hover:bg-muted/20">
        <td className="text-sm">{monthLabel(charge.month)} {charge.year}</td>
        <td className="font-medium">{charge.title}</td>
        <td className="number text-end">{money(charge.amount)}</td>
        <td className="number text-end text-emerald-600">{money(charge.paid)}</td>
        <td className={`number text-end font-bold ${charge.remaining > 0 ? "text-red-600" : "text-muted-foreground"}`}>{money(charge.remaining)}</td>
        <td>
          <div className="flex items-center justify-end gap-1">
            <button onClick={toggle} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title={en ? "Collections" : "التحصيلات"}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil size={13} /></button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="p-3">
            <div className="space-y-2">
              <p className="text-xs font-bold">{en ? "Collections" : "التحصيلات"}</p>
              {charge.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en ? "No collections" : "لا توجد تحصيلات"}</p>
              ) : (
                <div className="space-y-1">
                  {charge.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-xs">
                      <span>{new Date(p.paidDate).toLocaleDateString(en ? "en-US" : "ar-KW")}</span>
                      <span className="number font-medium text-emerald-600">{money(p.amount)}</span>
                      <button onClick={() => delPayment(p.id)} className="rounded p-1 text-muted-foreground hover:text-red-600"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">{en ? "Amount" : "المبلغ"}</label>
                  <input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field w-28 text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">{en ? "Date" : "تاريخ السداد"}</label>
                  <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="input-field text-sm" dir="ltr" />
                </div>
                <button onClick={addPayment} disabled={busy || !amount} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                  {en ? "Add collection" : "تسجيل تحصيل"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SalaryTab({
  companyId, investorId, batches, loading, reload, setError, money, monthLabel, en, numLoc,
}: {
  companyId: string; investorId: string; batches: Batch[]; loading: boolean; reload: () => void;
  setError: (s: string) => void; money: (n: number) => string; monthLabel: (m: number | null) => string; en: boolean; numLoc: string;
}) {
  const now = new Date();
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [commission, setCommission] = useState("");
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function openForm() {
    setShowForm(true);
    setSelected({});
    setCommission("");
    const res = await fetch(`/api/managers/investor-employees?companyId=${companyId}&investorId=${investorId}`);
    const p = await res.json();
    if (p.success) setEmployees(p.data);
  }
  function toggleEmp(emp: EmployeeOpt) {
    setSelected((prev) => {
      if (prev[emp.id] !== undefined) {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      }
      return { ...prev, [emp.id]: emp.salary };
    });
  }
  const selTotal = Object.values(selected).reduce((s, v) => s + (Number(v) || 0), 0);
  const grandTotal = selTotal + (Number(commission) || 0);

  async function save() {
    const lines = Object.entries(selected).map(([employeeId, amount]) => ({ employeeId, amount: Number(amount) || 0 }));
    if (lines.length === 0) { setError(en ? "Select at least one employee" : "اختر موظفاً واحداً على الأقل"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/managers/salary-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, investorId, month: Number(month), year: Number(year), bankCommission: Number(commission) || 0, lines }),
      });
      const p = await res.json();
      if (!p.success) throw new Error(p.error);
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm(en ? "Delete this salary batch?" : "حذف دفعة الرواتب دي؟")) return;
    const res = await fetch(`/api/managers/salary-batches/${id}`, { method: "DELETE" });
    const p = await res.json();
    if (!p.success) { setError(p.error); return; }
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openForm} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={15} /> {en ? "New salary batch" : "دفعة رواتب جديدة"}
        </button>
      </div>

      {showForm && (
        <div className="section-card space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{en ? "Month" : "الشهر"}</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-full text-sm">
                {MONTHS_AR.slice(1).map((m, i) => (<option key={i + 1} value={i + 1}>{en ? `M${i + 1}` : m}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{en ? "Year" : "السنة"}</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-full text-sm" dir="ltr" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{en ? "Bank commission" : "عمولة البنك"}</label>
              <input type="number" step="0.001" value={commission} onChange={(e) => setCommission(e.target.value)} className="input-field w-full text-sm" dir="ltr" placeholder="0.000" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">{en ? "Employees" : "الموظفون"}</p>
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground">{en ? "No employees linked to this official." : "لا يوجد موظفون مرتبطون بهذا المسئول."}</p>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border p-2">
                {employees.map((emp) => {
                  const isSel = selected[emp.id] !== undefined;
                  return (
                    <div key={emp.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                      <input type="checkbox" checked={isSel} onChange={() => toggleEmp(emp)} className="h-4 w-4 accent-primary" />
                      <span className="flex-1">{emp.nameAr}{emp.licenseName ? <span className="text-xs text-muted-foreground"> — {emp.licenseName}</span> : null}</span>
                      {isSel ? (
                        <input
                          type="number"
                          step="0.001"
                          value={selected[emp.id]}
                          onChange={(e) => setSelected({ ...selected, [emp.id]: Number(e.target.value) })}
                          className="input-field w-28 text-center text-sm"
                          dir="ltr"
                        />
                      ) : (
                        <span className="number w-28 text-center text-xs text-muted-foreground">{money(emp.salary)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 p-2 text-sm">
            <span>{en ? "Salaries: " : "الرواتب: "}<b>{money(selTotal)}</b></span>
            <span>{en ? "Commission: " : "العمولة: "}<b>{money(Number(commission) || 0)}</b></span>
            <span className="text-blue-600">{en ? "Total: " : "الإجمالي: "}<b>{money(grandTotal)}</b></span>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "..." : en ? "Save batch" : "حفظ الدفعة"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Cancel" : "إلغاء"}</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="ar-table text-sm">
          <thead>
            <tr>
              <th>{en ? "Period" : "الفترة"}</th>
              <th className="text-center">{en ? "Employees" : "موظفون"}</th>
              <th className="text-end">{en ? "Salaries" : "الرواتب"}</th>
              <th className="text-end">{en ? "Commission" : "العمولة"}</th>
              <th className="text-end">{en ? "Total" : "الإجمالي"}</th>
              <th className="text-end">{en ? "Collected" : "المُحصّل"}</th>
              <th className="text-end">{en ? "Remaining" : "المتبقي"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">...</td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{en ? "No batches" : "لا توجد دفعات"}</td></tr>
            ) : (
              batches.map((b) => (
                <BatchRow key={b.id} batch={b} expanded={expanded === b.id} toggle={() => setExpanded(expanded === b.id ? null : b.id)} reload={reload} setError={setError} money={money} monthLabel={monthLabel} onDelete={() => del(b.id)} en={en} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchRow({
  batch, expanded, toggle, reload, setError, money, monthLabel, onDelete, en,
}: {
  batch: Batch; expanded: boolean; toggle: () => void; reload: () => void; setError: (s: string) => void;
  money: (n: number) => string; monthLabel: (m: number | null) => string; onDelete: () => void; en: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function addPayment() {
    if (!amount) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/managers/salary-batches/${batch.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), paidDate, notes: null }),
      });
      const p = await res.json();
      if (!p.success) throw new Error(p.error);
      setAmount("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل");
    } finally {
      setBusy(false);
    }
  }
  async function delPayment(id: string) {
    const res = await fetch(`/api/managers/salary-payments/${id}`, { method: "DELETE" });
    const p = await res.json();
    if (!p.success) { setError(p.error); return; }
    reload();
  }

  return (
    <>
      <tr className="hover:bg-muted/20">
        <td>{monthLabel(batch.month)} {batch.year}</td>
        <td className="text-center">{batch.lines.length}</td>
        <td className="number text-end">{money(batch.salariesTotal)}</td>
        <td className="number text-end">{money(batch.bankCommission)}</td>
        <td className="number text-end font-bold">{money(batch.total)}</td>
        <td className="number text-end text-emerald-600">{money(batch.collected)}</td>
        <td className={`number text-end font-bold ${batch.remaining > 0 ? "text-red-600" : "text-muted-foreground"}`}>{money(batch.remaining)}</td>
        <td>
          <div className="flex items-center justify-end gap-1">
            <button onClick={toggle} className="rounded p-1.5 text-muted-foreground hover:bg-muted">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="p-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold">{en ? "Employees" : "الموظفون"}</p>
                <div className="space-y-1">
                  {batch.lines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-xs">
                      <span>{l.employeeName}</span>
                      <span className="number font-medium">{money(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold">{en ? "Collections" : "التحصيلات"}</p>
                {batch.payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{en ? "No collections" : "لا توجد تحصيلات"}</p>
                ) : (
                  <div className="space-y-1">
                    {batch.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-1.5 text-xs">
                        <span>{new Date(p.paidDate).toLocaleDateString(en ? "en-US" : "ar-KW")}</span>
                        <span className="number font-medium text-emerald-600">{money(p.amount)}</span>
                        <button onClick={() => delPayment(p.id)} className="rounded p-1 text-muted-foreground hover:text-red-600"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-2 pt-2">
                  <input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field w-28 text-sm" dir="ltr" placeholder={en ? "Amount" : "المبلغ"} />
                  <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="input-field text-sm" dir="ltr" />
                  <button onClick={addPayment} disabled={busy || !amount} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                    {en ? "Add collection" : "تسجيل تحصيل"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
