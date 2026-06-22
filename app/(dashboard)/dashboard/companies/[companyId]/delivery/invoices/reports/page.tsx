"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { ArrowRight, Download, Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Person { id: string; nameAr: string }
interface SummaryRow { name: string; targetType: string; count: number; total: number; lastDate: string }
interface DetailRow { id: string; name: string; targetType: string; invoiceDate: string; amount: number; currency: string; imagePath: string; notes: string | null }

export default function InvoicesReportPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const nl = en ? "en-US" : "ar-KW";
  const money = (n: number) => n.toLocaleString(nl, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(nl);
  const typeLabel = (t: string) => (t === "DRIVER" ? (en ? "Driver" : "سائق") : en ? "Employee" : "موظف");

  const [view, setView] = useState<"summary" | "details">("summary");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fType, setFType] = useState("");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersonId("");
    if (fType !== "DRIVER" && fType !== "EMPLOYEE") { setPeople([]); return; }
    fetch(`/api/delivery/invoices/people?companyId=${companyId}&type=${fType}`).then((r) => r.json()).then((p) => { if (p.success) setPeople(p.data); });
  }, [fType, companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ companyId, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(fType ? { targetType: fType } : {}),
      ...(personId ? (fType === "DRIVER" ? { driverId: personId } : { employeeId: personId }) : {}) });
    const res = await fetch(`/api/delivery/invoices/reports?${qs}`);
    const p = await res.json();
    setLoading(false);
    if (p.success) { setSummary(p.summary); setDetails(p.details); setGrandTotal(p.grandTotal); }
  }, [companyId, from, to, fType, personId]);

  useEffect(() => { load(); }, [load]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    if (view === "summary") {
      const rows = summary.map((r) => ({
        [en ? "Name" : "الاسم"]: r.name, [en ? "Type" : "النوع"]: typeLabel(r.targetType),
        [en ? "Count" : "عدد الفواتير"]: r.count, [en ? "Total" : "الإجمالي"]: r.total, [en ? "Last date" : "آخر فاتورة"]: fmtDate(r.lastDate),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Summary");
    } else {
      const rows = details.map((r) => ({
        [en ? "Date" : "التاريخ"]: fmtDate(r.invoiceDate), [en ? "Type" : "النوع"]: typeLabel(r.targetType),
        [en ? "Name" : "الاسم"]: r.name, [en ? "Amount" : "القيمة"]: r.amount, [en ? "Currency" : "العملة"]: r.currency,
        [en ? "Notes" : "ملاحظات"]: r.notes ?? "", [en ? "Image" : "الصورة"]: r.imagePath,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Invoices");
    }
    XLSX.writeFile(wb, `invoices-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <Header
        title={en ? "Invoices report" : "تقرير الفواتير"}
        subtitle={en ? "Driver & employee invoices — reference only" : "فواتير السائقين والموظفين — مرجعي فقط"}
        companyId={companyId}
        actions={
          <div className="flex gap-2 print:hidden">
            <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Download size={15} />{en ? "Excel" : "إكسل"}</button>
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Printer size={15} />{en ? "Print" : "طباعة"}</button>
          </div>
        }
      />
      <div className="page-container space-y-4">
        <Link href={`/dashboard/companies/${companyId}/delivery/invoices`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"><ArrowRight size={16} />{en ? "Back" : "العودة"}</Link>

        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <div className="flex rounded-lg border p-1">
            <button onClick={() => setView("summary")} className={`rounded px-3 py-1 text-sm ${view === "summary" ? "bg-primary text-primary-foreground" : ""}`}>{en ? "Summary" : "مجمّع"}</button>
            <button onClick={() => setView("details")} className={`rounded px-3 py-1 text-sm ${view === "details" ? "bg-primary text-primary-foreground" : ""}`}>{en ? "Detailed" : "تفصيلي"}</button>
          </div>
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Type" : "النوع"}</label><select value={fType} onChange={(e) => setFType(e.target.value)} className="input-field text-sm"><option value="">{en ? "All" : "الكل"}</option><option value="DRIVER">{en ? "Driver" : "سائق"}</option><option value="EMPLOYEE">{en ? "Employee" : "موظف"}</option></select></div>
          {(fType === "DRIVER" || fType === "EMPLOYEE") && (
            <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Person" : "الشخص"}</label><select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input-field text-sm"><option value="">{en ? "All" : "الكل"}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.nameAr}</option>)}</select></div>
          )}
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "From" : "من"}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field text-sm" dir="ltr" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "To" : "إلى"}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field text-sm" dir="ltr" /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="stat-card"><div><p className="number text-2xl font-bold">{details.length}</p><p className="text-xs text-muted-foreground">{en ? "Invoices" : "عدد الفواتير"}</p></div></div>
          <div className="stat-card"><div><p className="number text-2xl font-bold text-blue-600">{money(grandTotal)}</p><p className="text-xs text-muted-foreground">{en ? "Total" : "الإجمالي"}</p></div></div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{en ? "Loading..." : "جاري التحميل..."}</p>
        ) : view === "summary" ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="ar-table text-sm">
              <thead><tr><th>{en ? "Name" : "الاسم"}</th><th>{en ? "Type" : "النوع"}</th><th className="text-center">{en ? "Count" : "عدد الفواتير"}</th><th className="text-end">{en ? "Total" : "الإجمالي"}</th><th>{en ? "Last invoice" : "آخر فاتورة"}</th></tr></thead>
              <tbody>
                {summary.length === 0 ? (<tr><td colSpan={5} className="py-6 text-center text-muted-foreground">—</td></tr>) : summary.map((r, i) => (
                  <tr key={i}><td className="font-medium">{r.name}</td><td>{typeLabel(r.targetType)}</td><td className="number text-center">{r.count}</td><td className="number text-end font-bold text-blue-600">{money(r.total)}</td><td className="text-sm">{fmtDate(r.lastDate)}</td></tr>
                ))}
              </tbody>
              {summary.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30 font-bold"><td colSpan={3}>{en ? "Grand total" : "الإجمالي العام"}</td><td className="number text-end text-blue-600">{money(grandTotal)}</td><td></td></tr></tfoot>}
            </table>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="ar-table text-sm">
                <thead><tr><th>{en ? "Date" : "التاريخ"}</th><th>{en ? "Type" : "النوع"}</th><th>{en ? "Name" : "الاسم"}</th><th className="text-end">{en ? "Amount" : "القيمة"}</th><th>{en ? "Currency" : "العملة"}</th><th className="text-center print:hidden">{en ? "Image" : "الصورة"}</th><th>{en ? "Notes" : "ملاحظات"}</th></tr></thead>
                <tbody>
                  {details.length === 0 ? (<tr><td colSpan={7} className="py-6 text-center text-muted-foreground">—</td></tr>) : details.map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm">{fmtDate(r.invoiceDate)}</td><td>{typeLabel(r.targetType)}</td><td className="font-medium">{r.name}</td>
                      <td className="number text-end font-bold text-blue-600">{money(r.amount)}</td><td className="text-xs">{r.currency}</td>
                      <td className="text-center print:hidden"><a href={r.imagePath} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{en ? "View" : "عرض"}</a></td>
                      <td className="max-w-32 truncate text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {details.length > 0 && <tfoot><tr className="border-t-2 bg-muted/30 font-bold"><td colSpan={3} className="text-end">{en ? "Grand total" : "الإجمالي العام"}</td><td className="number text-end text-blue-600">{money(grandTotal)}</td><td colSpan={3}></td></tr></tfoot>}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
