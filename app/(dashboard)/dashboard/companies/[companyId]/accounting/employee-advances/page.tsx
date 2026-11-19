"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FinanceMetric, FinanceEmpty, financePrimary, financeOutline, financeSmall } from "@/components/finance/workspace";
import Link from "next/link";
import { Plus, Printer, Wallet, CheckCircle2, Clock3, Search, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLocale } from "@/components/providers/locale-provider";

type Installment = { id: string; year: number; month: number; amount: string; batch: { id: string; status: string } | null };
type Advance = { id: string; amount: string; date: string; notes: string | null; isCancelled: boolean; journalEntryId: string | null; employee: { nameAr: string; nameEn: string | null; employeeNumber: string | null }; installments: Installment[] };
type Lookup = { id: string; nameAr: string; employeeNumber?: string | null; code?: string };
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function EmployeeAdvancesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([{ month: currentMonth(), amount: "" }]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const load = useCallback(async () => {
    const response = await fetch(`/api/accounting/employee-advances?companyId=${companyId}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر تحميل السلف");
    setAdvances(payload.data.advances); setEmployees(payload.data.employees); setAccounts(payload.data.accounts);
  }, [companyId]);
  useEffect(() => { load().catch(error => setError(error.message)).finally(() => setLoading(false)); }, [load]);
  const scheduled = rows.reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 1000), 0);
  const distribute = () => {
    const total = Math.round(Number(amount) * 1000);
    if (!Number.isFinite(total) || total <= 0) return;
    const each = Math.floor(total / rows.length);
    setRows(rows.map((row, index) => ({ ...row, amount: ((each + (index === rows.length - 1 ? total - each * rows.length : 0)) / 1000).toFixed(3) })));
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/accounting/employee-advances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, employeeId, cashAccountId, amount: Number(amount), date, notes, installments: rows.map(row => ({ year: Number(row.month.slice(0, 4)), month: Number(row.month.slice(5, 7)), amount: Number(row.amount) })) }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر تسجيل السلفة");
      setOpen(false); setAmount(""); setNotes(""); setEmployeeId(""); setRows([{ month: currentMonth(), amount: "" }]); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "تعذر الحفظ"); } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (!window.confirm(en ? "Cancel this advance and its unposted journal?" : "إلغاء السلفة وقيد الصرف غير المرحل؟")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/accounting/employee-advances", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "تعذر الإلغاء"); } finally { setBusy(false); }
  }
  const filtered = advances.filter(advance => (!search || `${advance.employee.nameAr} ${advance.employee.nameEn || ""} ${advance.employee.employeeNumber || ""}`.includes(search)) && (!monthFilter || advance.installments.some(row => `${row.year}-${String(row.month).padStart(2, "0")}` === monthFilter)));
  const active = filtered.filter(advance => !advance.isCancelled);
  const total = active.reduce((sum, row) => sum + Number(row.amount), 0);
  const paid = active.reduce((sum, row) => sum + row.installments.filter(item => item.batch?.status === "PAID").reduce((sum, item) => sum + Number(item.amount), 0), 0);
  return <div className="finance-workspace">
    <Header title={en ? "Employee advances" : "سلف الموظفين"} companyId={companyId} subtitle={en ? "Disbursement and payroll repayment schedules" : "صرف السلف وجدولة أقساط الخصم من الرواتب"} actions={<div className="flex gap-2"><button className={financeOutline} onClick={() => window.print()}><Printer size={16} />{en ? "Print report" : "طباعة التقرير"}</button><button className={financePrimary} onClick={() => setOpen(!open)}>{open ? <X size={16} /> : <Plus size={16} />}{open ? (en ? "Close" : "إغلاق") : (en ? "New advance" : "سلفة جديدة")}</button></div>} />
    <div className="page-container space-y-6"><div className="print-only mb-6 border-b-2 pb-4"><h1 className="text-2xl font-bold">{en ? "Employee advances report" : "تقرير سلف الموظفين"}</h1><p>{monthFilter || (en ? "All months" : "كل الشهور")} · {search || (en ? "All employees" : "كل الموظفين")}</p></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      <p className="no-print rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm leading-7 text-blue-800">{en ? "Each advance creates a draft disbursement journal. Installments are reserved in payroll and counted as repaid when payroll is marked paid." : "تسجيل السلفة ينشئ قيد صرف مسودة للمراجعة والترحيل. القسط يُحجز في دفعة الرواتب، ويُعتبر مسدداً عند تأكيد صرف الدفعة."}</p>
      {open && <form onSubmit={submit} className="section-card no-print space-y-5"><h2 className="border-b pb-4 text-lg font-bold">{en ? "New advance" : "تسجيل سلفة جديدة"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect label={en ? "Employee" : "الموظف"} value={employeeId} onChange={setEmployeeId} options={employees.map(employee => ({ value: employee.id, label: `${employee.nameAr}${employee.employeeNumber ? ` (${employee.employeeNumber})` : ""}` }))} placeholder={en ? "Select employee" : "اختر الموظف"} />
          <label>{en ? "Disbursement account" : "الصندوق أو البنك"}<select required className="input-field mt-1 w-full" value={cashAccountId} onChange={event => setCashAccountId(event.target.value)}><option value="">{en ? "Select account" : "اختر الحساب"}</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.code} - {account.nameAr}</option>)}</select></label>
          <label>{en ? "Advance amount (KD)" : "قيمة السلفة (د.ك)"}<input required type="number" min="0.001" step="0.001" className="input-field mt-1 w-full" value={amount} onChange={event => setAmount(event.target.value)} /></label>
          <label>{en ? "Disbursement date" : "تاريخ الصرف"}<input required type="date" className="input-field mt-1 w-full" value={date} onChange={event => setDate(event.target.value)} /></label>
        </div>
        <h2 className="font-bold">{en ? "Repayment months" : "شهور السداد"}</h2>
        <p className="text-sm text-muted-foreground">{en ? "Choose each month and its installment. Months do not have to be consecutive." : "اختر كل شهر وقيمة القسط فيه. ممكن تختار شهور غير متتالية."}</p>
        {rows.map((row, index) => <div key={index} className="flex flex-wrap items-end gap-3">
          <label>{en ? "Month / year" : "الشهر / السنة"}<input aria-label={en ? "Repayment month" : "شهر السداد"} required type="month" min={date.slice(0, 7)} value={row.month} className="input-field block" onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, month: event.target.value } : item))} /></label>
          <label>{en ? "Installment (KD)" : "القسط (د.ك)"}<input required type="number" min="0.001" step="0.001" value={row.amount} className="input-field block" onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} /></label>
          <button type="button" className="rounded-lg border p-2 text-red-600" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))}>{en ? "Remove" : "حذف الشهر"}</button>
        </div>)}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={financeOutline} disabled={rows.length >= 120} onClick={() => { const last = rows[rows.length - 1].month || currentMonth(); const next = new Date(`${last}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); setRows([...rows, { month: next.toISOString().slice(0, 7), amount: "" }]); }}>{en ? "Add month" : "إضافة شهر"}</button>
          <button type="button" className={financeOutline} onClick={distribute}>{en ? "Split equally" : "توزيع بالتساوي"}</button>
          <p className="p-2">{en ? "Scheduled" : "إجمالي الأقساط"}: {money(scheduled / 1000)} / {money(Number(amount || 0))}</p>
        </div>
        <label className="block">{en ? "Notes" : "ملاحظات"}<textarea maxLength={2000} className="input-field mt-1 w-full" value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <button className={financePrimary} disabled={busy || !employeeId || scheduled !== Math.round(Number(amount) * 1000)}>{busy ? (en ? "Saving…" : "جارٍ الحفظ…") : (en ? "Save advance" : "تسجيل السلفة")}</button>
      </form>}
      <div className="section-card no-print grid items-end gap-4 md:grid-cols-[1fr_240px_auto]">
        <label><span className="form-label">{en ? "Employee" : "الموظف"}</span><div className="relative"><Search size={16} className="pointer-events-none absolute start-3 top-3 text-muted-foreground" /><input className="input-field ps-10" placeholder={en ? "Search name or number" : "بحث باسم الموظف أو رقمه"} value={search} onChange={event => setSearch(event.target.value)} /></div></label>
        <label><span className="form-label">{en ? "Repayment month" : "شهر السداد"}</span><input type="month" className="input-field" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} /></label><button className={financeOutline} onClick={() => { setSearch(""); setMonthFilter(""); }}>{en ? "Clear filters" : "مسح الفلاتر"}</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><FinanceMetric label={en ? "Advances (KWD)" : "إجمالي السلف (د.ك)"} value={money(total)} icon={<Wallet size={20} />} tone="blue" /><FinanceMetric label={en ? "Repaid (KWD)" : "المسدد (د.ك)"} value={money(paid)} icon={<CheckCircle2 size={20} />} tone="positive" /><FinanceMetric label={en ? "Remaining (KWD)" : "المتبقي (د.ك)"} value={money(total - paid)} icon={<Clock3 size={20} />} /></div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold">{en ? "Advances register" : "سجل سلف الموظفين"}</h2><span className="rounded-full bg-muted px-3 py-1 text-xs">{filtered.length}</span></div>
      {loading ? <p role="status" className="p-10 text-center text-muted-foreground">{en ? "Loading…" : "جارٍ تحميل السلف…"}</p> : filtered.length === 0 ? <FinanceEmpty title={en ? "No matching advances" : "لا توجد سلف مطابقة"} description={en ? "Add an advance or change the filters." : "أضف سلفة جديدة أو غيّر فلاتر البحث."} /> : null}
      {filtered.map(advance => <div key={advance.id} className="space-y-4 border-b p-5 last:border-b-0">
        <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/40 p-4"><strong>{advance.employee.nameAr} — {money(Number(advance.amount))} KWD</strong><span>{advance.date.slice(0, 10)} {advance.isCancelled && (en ? " — Cancelled" : " — ملغاة")}</span></div>
        {advance.notes && <p>{advance.notes}</p>}
        <div className="overflow-x-auto"><table className="ar-table"><thead><tr><th>{en ? "Month" : "الشهر"}</th><th>{en ? "Installment" : "القسط"}</th><th>{en ? "Status" : "الحالة"}</th></tr></thead><tbody>{advance.installments.map(row => <tr key={row.id}><td>{row.month}/{row.year}</td><td>{money(Number(row.amount))}</td><td>{advance.isCancelled ? (en ? "Cancelled" : "ملغى") : row.batch ? <Link className="text-blue-700 underline" href={`/dashboard/companies/${companyId}/hr/salaries/${row.batch.id}`}>{row.batch.status === "PAID" ? (en ? "Repaid" : "مسدد") : (en ? "Reserved in payroll" : "محجوز في دفعة رواتب")}</Link> : (en ? "Scheduled" : "مجدول")}</td></tr>)}</tbody></table></div>
        <div className="no-print flex flex-wrap gap-2">{advance.journalEntryId && <Link className={financeSmall} href={`/dashboard/companies/${companyId}/accounting/journal-entries/${advance.journalEntryId}`}>{en ? "Disbursement journal" : "قيد الصرف"}</Link>}{!advance.isCancelled && !advance.installments.some(row => row.batch) && <button disabled={busy} onClick={() => cancel(advance.id)} className={`${financeSmall} text-red-600`}>{en ? "Cancel advance" : "إلغاء السلفة"}</button>}</div>
      </div>)}
      </section>
    </div>
  </div>;
}
