"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Eye, FileBarChart, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { parseInvoiceText } from "@/lib/delivery/invoice-parse";

interface Person { id: string; nameAr: string; nameEn?: string | null }
interface Invoice {
  id: string; targetType: string; name: string; invoiceDate: string; amount: number;
  currency: string; imagePath: string; notes: string | null;
}
interface Row {
  file: File | null; preview: string; date: string; amount: string; notes: string;
  ocrText: string; ocrAmount: number | null; ocrDate: string | null; ocrBusy: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyRow = (): Row => ({ file: null, preview: "", date: "", amount: "", notes: "", ocrText: "", ocrAmount: null, ocrDate: null, ocrBusy: false });

export default function DeliveryInvoicesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const nl = en ? "en-US" : "ar-KW";
  const money = (n: number) => n.toLocaleString(nl, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fType, setFType] = useState("");
  const [search, setSearch] = useState("");
  const [viewImg, setViewImg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ companyId, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(fType ? { targetType: fType } : {}), ...(search ? { search } : {}) });
    const res = await fetch(`/api/delivery/invoices?${qs}`);
    const p = await res.json();
    if (p.success) setInvoices(p.data);
    setLoading(false);
  }, [companyId, from, to, fType, search]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    count: invoices.length,
    total: invoices.reduce((s, i) => s + i.amount, 0),
    people: new Set(invoices.map((i) => i.name)).size,
  }), [invoices]);

  return (
    <div>
      <Header
        title={en ? "Invoices" : "الفواتير"}
        subtitle={en ? "Driver & employee invoices archive — reference only" : "أرشيف فواتير السائقين والموظفين — مرجعي فقط"}
        companyId={companyId}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/companies/${companyId}/delivery/invoices/reports`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
              <FileBarChart size={16} /> {en ? "Report" : "تقرير الفواتير"}
            </Link>
          </div>
        }
      />
      <div className="page-container space-y-4">
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {en ? "Archive only — does not affect accounting." : "أرشفة ومتابعة فقط — لا يؤثر على الحسابات."}
        </div>

        <AddInvoices companyId={companyId} en={en} onSaved={load} />

        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card"><div><p className="number text-2xl font-bold">{stats.count}</p><p className="text-xs text-muted-foreground">{en ? "Invoices" : "عدد الفواتير"}</p></div></div>
          <div className="stat-card"><div><p className="number text-2xl font-bold text-blue-600">{money(stats.total)}</p><p className="text-xs text-muted-foreground">{en ? "Total amount" : "إجمالي القيمة"}</p></div></div>
          <div className="stat-card"><div><p className="number text-2xl font-bold">{stats.people}</p><p className="text-xs text-muted-foreground">{en ? "People" : "عدد الأشخاص"}</p></div></div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "From" : "من"}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" dir="ltr" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "To" : "إلى"}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" dir="ltr" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Type" : "النوع"}</label>
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="input-field w-36">
              <option value="">{en ? "All" : "الكل"}</option>
              <option value="DRIVER">{en ? "Driver" : "سائق"}</option>
              <option value="EMPLOYEE">{en ? "Employee" : "موظف"}</option>
            </select>
          </div>
          <div className="flex-1 min-w-40"><label className="mb-1 block text-xs text-muted-foreground">{en ? "Search" : "بحث"}</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={en ? "Name / notes" : "اسم / ملاحظات"} className="input-field w-full" /></div>
          {(from || to || fType || search) && <button onClick={() => { setFrom(""); setTo(""); setFType(""); setSearch(""); }} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">{en ? "Clear" : "مسح"}</button>}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table text-sm">
              <thead><tr><th>{en ? "Date" : "التاريخ"}</th><th>{en ? "Type" : "النوع"}</th><th>{en ? "Name" : "الاسم"}</th><th className="text-end">{en ? "Amount" : "القيمة"}</th><th>{en ? "Currency" : "العملة"}</th><th className="text-center">{en ? "Image" : "الصورة"}</th><th>{en ? "Notes" : "ملاحظات"}</th><th></th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{en ? "Loading..." : "جاري التحميل..."}</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{en ? "No invoices" : "لا توجد فواتير"}</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="text-sm">{new Date(inv.invoiceDate).toLocaleDateString(nl)}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs ${inv.targetType === "DRIVER" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{inv.targetType === "DRIVER" ? (en ? "Driver" : "سائق") : en ? "Employee" : "موظف"}</span></td>
                    <td className="font-medium">{inv.name}</td>
                    <td className="number text-end font-bold text-blue-600">{money(inv.amount)}</td>
                    <td className="text-xs">{inv.currency}</td>
                    <td className="text-center"><button onClick={() => setViewImg(inv.imagePath)} className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye size={14} /></button></td>
                    <td className="max-w-40 truncate text-xs text-muted-foreground">{inv.notes ?? "—"}</td>
                    <td className="text-center"><DeleteBtn id={inv.id} en={en} onDone={load} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setViewImg(null)}>
          <div className="relative max-h-[90vh] max-w-3xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewImg(null)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-black"><X size={18} /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewImg} alt="invoice" className="max-h-[88vh] rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteBtn({ id, en, onDone }: { id: string; en: boolean; onDone: () => void }) {
  async function del() {
    if (!confirm(en ? "Delete this invoice?" : "حذف هذه الفاتورة؟")) return;
    const r = await fetch(`/api/delivery/invoices/${id}`, { method: "DELETE" });
    if ((await r.json()).success) onDone();
  }
  return <button onClick={del} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>;
}

async function runOcr(file: File): Promise<string> {
  try {
    const mod = await import("tesseract.js");
    const Tesseract = (mod as { default?: { recognize: (img: File, langs: string) => Promise<{ data: { text: string } }> } }).default ?? (mod as unknown as { recognize: (img: File, langs: string) => Promise<{ data: { text: string } }> });
    const result = await Tesseract.recognize(file, "ara+eng");
    return result.data.text || "";
  } catch {
    return "";
  }
}

function AddInvoices({ companyId, en, onSaved }: { companyId: string; en: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"DRIVER" | "EMPLOYEE">("DRIVER");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPersonId("");
    fetch(`/api/delivery/invoices/people?companyId=${companyId}&type=${type}`).then((r) => r.json()).then((p) => { if (p.success) setPeople(p.data); });
  }, [open, type, companyId]);

  function openModal(multi: boolean) {
    setType("DRIVER"); setRows(multi ? [emptyRow(), emptyRow()] : [emptyRow()]); setError(""); setOpen(true);
  }

  async function pickFile(index: number, file: File | null) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, file, preview, ocrBusy: true } : r)));
    const text = await runOcr(file);
    const { amount, date } = parseInvoiceText(text);
    setRows((prev) => prev.map((r, i) => i === index
      ? { ...r, ocrBusy: false, ocrText: text, ocrAmount: amount, ocrDate: date, amount: r.amount || (amount != null ? String(amount) : ""), date: r.date || date || "" }
      : r));
  }

  function updateRow(index: number, patch: Partial<Row>) { setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r))); }
  function addRow() { setRows((prev) => [...prev, emptyRow()]); }
  function removeRow(index: number) { setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)); }

  async function save() {
    if (!personId) { setError(en ? "Select a person" : "اختر السائق/الموظف"); return; }
    const valid = rows.filter((r) => r.file);
    if (valid.length === 0) { setError(en ? "Add at least one invoice image" : "أضف صورة فاتورة واحدة على الأقل"); return; }
    for (const r of valid) {
      if (!r.date || !r.amount) { setError(en ? "Each invoice needs a date and amount" : "كل فاتورة تحتاج تاريخ وقيمة"); return; }
    }
    setSaving(true); setError("");
    try {
      for (const r of valid) {
        const fd = new FormData();
        fd.append("file", r.file!);
        fd.append("companyId", companyId);
        fd.append("targetType", type);
        fd.append(type === "DRIVER" ? "driverId" : "employeeId", personId);
        fd.append("invoiceDate", r.date);
        fd.append("amount", r.amount);
        if (r.notes) fd.append("notes", r.notes);
        if (r.ocrText) fd.append("ocrText", r.ocrText);
        if (r.ocrAmount != null) fd.append("ocrAmount", String(r.ocrAmount));
        if (r.ocrDate) fd.append("ocrDate", r.ocrDate);
        const res = await fetch("/api/delivery/invoices", { method: "POST", body: fd });
        const p = await res.json();
        if (!p.success) { setError(p.error); setSaving(false); return; }
      }
      setOpen(false); onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => openModal(false)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus size={16} />{en ? "Add invoice" : "إضافة فاتورة"}</button>
        <button onClick={() => openModal(true)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"><Plus size={16} />{en ? "Add invoices" : "إضافة فواتير"}</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="my-6 w-full max-w-2xl space-y-4 rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{en ? "Add invoices" : "إضافة فواتير"}</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{en ? "Type" : "النوع"}</label>
                <select value={type} onChange={(e) => setType(e.target.value as "DRIVER" | "EMPLOYEE")} className="input-field w-full text-sm">
                  <option value="DRIVER">{en ? "Driver" : "سائق"}</option>
                  <option value="EMPLOYEE">{en ? "Employee" : "موظف"}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{type === "DRIVER" ? (en ? "Driver" : "السائق") : en ? "Employee" : "الموظف"} *</label>
                <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input-field w-full text-sm">
                  <option value="">{en ? "Select..." : "اختر..."}</option>
                  {people.map((p) => (<option key={p.id} value={p.id}>{en ? p.nameEn ?? p.nameAr : p.nameAr}</option>))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">{en ? `Invoice ${i + 1}` : `فاتورة ${i + 1}`}</span>
                    {rows.length > 1 && <button onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">{en ? "Invoice image *" : "صورة الفاتورة *"}</label>
                      <input type="file" accept="image/*" onChange={(e) => pickFile(i, e.target.files?.[0] ?? null)} className="block w-full text-xs" />
                      {row.preview && (
                        <div className="mt-2 flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.preview} alt="preview" className="h-14 w-14 rounded border object-cover" />
                          {row.ocrBusy && <span className="text-xs text-amber-600">{en ? "Extracting..." : "جاري الاستخراج..."}</span>}
                          {!row.ocrBusy && row.ocrText && <span className="text-xs text-emerald-600">{en ? "Extracted (review)" : "تم الاستخراج (راجع)"}</span>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Date *" : "التاريخ *"}</label><input type="date" value={row.date} onChange={(e) => updateRow(i, { date: e.target.value })} className="input-field w-full text-sm" dir="ltr" /></div>
                      <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Amount *" : "القيمة *"}</label><input type="number" step="0.001" value={row.amount} onChange={(e) => updateRow(i, { amount: e.target.value })} className="input-field w-full text-sm" dir="ltr" /></div>
                      <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">{en ? "Notes" : "ملاحظات"}</label><input value={row.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} className="input-field w-full text-sm" /></div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addRow} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"><ImageIcon size={13} />{en ? "Add another image" : "إضافة صورة أخرى"}</button>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? (en ? "Saving..." : "جارٍ الحفظ...") : en ? "Save" : "حفظ"}</button>
              <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Cancel" : "إلغاء"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
