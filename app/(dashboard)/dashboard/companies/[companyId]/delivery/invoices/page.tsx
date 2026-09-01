"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Eye, FileBarChart, Image as ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { parseInvoiceText } from "@/lib/delivery/invoice-parse";
import { readInvoiceImage } from "@/lib/delivery/invoice-ocr";

interface Person {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface Invoice {
  id: string;
  targetType: "DRIVER" | "EMPLOYEE";
  driverId?: string | null;
  employeeId?: string | null;
  name: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  imagePath: string;
  originalFileName?: string | null;
  notes: string | null;
  reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  uploadSource: "ADMIN" | "DRIVER_WEB" | "DRIVER_MOBILE";
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface Row {
  file: File | null;
  preview: string;
  date: string;
  amount: string;
  notes: string;
  ocrText: string;
  ocrAmount: number | null;
  ocrDate: string | null;
  ocrBusy: boolean;
  ocrFailed: boolean;
}

const emptyRow = (): Row => ({
  file: null,
  preview: "",
  date: "",
  amount: "",
  notes: "",
  ocrText: "",
  ocrAmount: null,
  ocrDate: null,
  ocrBusy: false,
  ocrFailed: false,
});

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function runOcr(file: File): Promise<string> { try { return (await readInvoiceImage(file)).text; } catch { return ""; } }

async function loadPeople(companyId: string, type: "DRIVER" | "EMPLOYEE"): Promise<Person[]> {
  const response = await fetch(`/api/delivery/invoices/people?companyId=${companyId}&type=${type}`);
  const payload = await response.json();
  return payload.success ? payload.data : [];
}

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
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [fType, setFType] = useState("");
  const [drivers, setDrivers] = useState<Person[]>([]);
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<Invoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    loadPeople(companyId, "DRIVER").then(setDrivers);
  }, [companyId]);

  const load = useCallback(async () => {
    setLoading(true);

    // Calculate from/to from month/year if selected
    let effectiveFrom = from;
    let effectiveTo = to;
    if (month && year) {
      const monthNum = Number.parseInt(month, 10);
      const yearNum = Number.parseInt(year, 10);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0);
      // Format dates without timezone conversion
      effectiveFrom = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      effectiveTo = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    } else if (year && !from && !to) {
      const yearNum = Number.parseInt(year, 10);
      effectiveFrom = `${yearNum}-01-01`;
      effectiveTo = `${yearNum}-12-31`;
    }

    const qs = new URLSearchParams({
      companyId,
      ...(effectiveFrom ? { from: effectiveFrom } : {}),
      ...(effectiveTo ? { to: effectiveTo } : {}),
      ...(fType ? { targetType: fType } : {}),
      ...(driverId ? { driverId } : {}),
      ...(search ? { search } : {}),
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(uploadSource ? { uploadSource } : {}),
    });
    const res = await fetch(`/api/delivery/invoices?${qs}`);
    const p = await res.json();
    if (p.success) setInvoices(p.data);
    setLoading(false);
  }, [companyId, from, to, month, year, fType, driverId, search, reviewStatus, uploadSource]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    // Rejected invoices remain visible for auditing, but never count in totals.
    // Soft-deleted invoices are already excluded by the API.
    const countedInvoices = invoices.filter((invoice) => invoice.reviewStatus !== "REJECTED");
    return {
      count: invoices.length,
      total: countedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      people: new Set(invoices.map((invoice) => invoice.name)).size,
    };
  }, [invoices]);

  const review = async (invoice: Invoice, status: "APPROVED" | "REJECTED", reason?: string) => {
    setReviewingId(invoice.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/driver/invoices/${invoice.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "REJECTED" ? { status, rejectionReason: reason } : { status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Review failed");
      setMessage(en ? "Invoice review saved" : "تم حفظ مراجعة الفاتورة");
      setRejectingInvoice(null);
      setRejectionReason("");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : (en ? "Review failed" : "فشلت المراجعة"));
    } finally {
      setReviewingId(null);
    }
  };

  const statusBadge = (status: Invoice["reviewStatus"]) => {
    const colors = {
      PENDING_REVIEW: "bg-amber-100 text-amber-800",
      APPROVED: "bg-emerald-100 text-emerald-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    const labels = {
      PENDING_REVIEW: en ? "Pending review" : "قيد المراجعة",
      APPROVED: en ? "Approved" : "معتمدة",
      REJECTED: en ? "Rejected" : "مرفوضة",
    };
    return <span className={`rounded-full px-2 py-0.5 text-xs ${colors[status]}`}>{labels[status]}</span>;
  };

  return (
    <div>
      <Header
        title={en ? "Invoices" : "الفواتير"}
        subtitle={en ? "Driver & employee invoices archive - reference only" : "أرشيف فواتير السائقين والموظفين - مرجعي فقط"}
        companyId={companyId}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/companies/${companyId}/delivery/invoices/reports`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
              <FileBarChart size={16} /> {en ? "Report" : "تقرير الفواتير"}
            </Link>
          </div>
        )}
      />

      <div className="page-container space-y-4">
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {en ? "Archive only - does not affect accounting." : "أرشفة ومتابعة فقط - لا يؤثر على الحسابات."}
        </div>

        {message && (
          <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <AddInvoices
          companyId={companyId}
          en={en}
          onSaved={() => {
            setMessage("");
            load();
          }}
        />

        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card"><div><p className="number text-2xl font-bold">{stats.count}</p><p className="text-xs text-muted-foreground">{en ? "Invoices" : "عدد الفواتير"}</p></div></div>
          <div className="stat-card"><div><p className="number text-2xl font-bold text-blue-600">{money(stats.total)}</p><p className="text-xs text-muted-foreground">{en ? "Total amount" : "إجمالي القيمة"}</p></div></div>
          <div className="stat-card"><div><p className="number text-2xl font-bold">{stats.people}</p><p className="text-xs text-muted-foreground">{en ? "People" : "عدد الأشخاص"}</p></div></div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Year" : "السنة"}</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="input-field w-32">
              <option value="">{en ? "All" : "الكل"}</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Month" : "الشهر"}</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="input-field w-32">
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
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "From" : "من"}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" dir="ltr" /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "To" : "إلى"}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" dir="ltr" /></div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Type" : "النوع"}</label>
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="input-field w-36">
              <option value="">{en ? "All" : "الكل"}</option>
              <option value="DRIVER">{en ? "Driver" : "سائق"}</option>
              <option value="EMPLOYEE">{en ? "Employee" : "موظف"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Driver" : "السائق"}</label>
            <input
              list="invoice-driver-options"
              value={driverName}
              onChange={(event) => {
                const value = event.target.value;
                setDriverName(value);
                const selectedDriver = drivers.find((driver) => (en ? driver.nameEn ?? driver.nameAr : driver.nameAr) === value);
                setDriverId(selectedDriver?.id ?? "");
              }}
              placeholder={en ? "Type or select a driver" : "اكتب أو اختر اسم السائق"}
              className="input-field w-48"
            />
            <datalist id="invoice-driver-options">
              {drivers.map((driver) => {
                const name = en ? driver.nameEn ?? driver.nameAr : driver.nameAr;
                return <option key={driver.id} value={name} />;
              })}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Review" : "المراجعة"}</label>
            <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="input-field w-40">
              <option value="">{en ? "All" : "الكل"}</option>
              <option value="PENDING_REVIEW">{en ? "Pending review" : "قيد المراجعة"}</option>
              <option value="APPROVED">{en ? "Approved" : "معتمدة"}</option>
              <option value="REJECTED">{en ? "Rejected" : "مرفوضة"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Source" : "المصدر"}</label>
            <select value={uploadSource} onChange={(e) => setUploadSource(e.target.value)} className="input-field w-36">
              <option value="">{en ? "All" : "الكل"}</option>
              <option value="DRIVER_WEB">DRIVER_WEB</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="min-w-40 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Search" : "بحث"}</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={en ? "Name / notes" : "اسم / ملاحظات"} className="input-field w-full" />
          </div>
          {(from || to || month || year || fType || driverId || driverName || search || reviewStatus || uploadSource) && (
            <button onClick={() => { setFrom(""); setTo(""); setMonth(""); setYear(""); setFType(""); setDriverId(""); setDriverName(""); setSearch(""); setReviewStatus(""); setUploadSource(""); }} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              {en ? "Clear" : "مسح"}
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table text-sm">
              <thead>
                <tr>
                  <th>{en ? "Date" : "التاريخ"}</th>
                  <th>{en ? "Type" : "النوع"}</th>
                  <th>{en ? "Name" : "الاسم"}</th>
                  <th className="text-end">{en ? "Amount" : "القيمة"}</th>
                  <th>{en ? "Currency" : "العملة"}</th>
                  <th className="text-center">{en ? "Image" : "الصورة"}</th>
                  <th>{en ? "Notes" : "ملاحظات"}</th>
                  <th>{en ? "Review" : "المراجعة"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{en ? "Loading..." : "جاري التحميل..."}</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{en ? "No invoices" : "لا توجد فواتير"}</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="text-sm">{new Date(inv.invoiceDate).toLocaleDateString(nl)}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs ${inv.targetType === "DRIVER" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{inv.targetType === "DRIVER" ? (en ? "Driver" : "سائق") : en ? "Employee" : "موظف"}</span></td>
                    <td className="font-medium">{inv.name}</td>
                    <td className="number text-end font-bold text-blue-600">{money(inv.amount)}</td>
                    <td className="text-xs">{inv.currency}</td>
                    <td className="text-center">
                      <button onClick={() => setViewImg(inv.imagePath)} className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Eye size={14} />
                      </button>
                    </td>
                    <td className="max-w-40 truncate text-xs text-muted-foreground">{inv.notes ?? "-"}</td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1">{statusBadge(inv.reviewStatus)}<span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">{inv.uploadSource}</span></div>
                        <div className="text-[11px] text-muted-foreground">{en ? "Uploaded" : "رُفعت"} {new Date(inv.createdAt).toLocaleDateString(nl)}</div>
                        {inv.reviewStatus === "REJECTED" && inv.rejectionReason && <div className="max-w-40 text-[11px] text-red-700">{inv.rejectionReason}</div>}
                        {inv.reviewStatus === "PENDING_REVIEW" && inv.uploadSource !== "ADMIN" && (
                          <div className="flex gap-1 pt-1">
                            <button disabled={reviewingId === inv.id} onClick={() => review(inv, "APPROVED")} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50">{en ? "Approve" : "اعتماد"}</button>
                            <button disabled={reviewingId === inv.id} onClick={() => { setError(""); setRejectingInvoice(inv); }} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">{en ? "Reject" : "رفض"}</button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setMessage(""); setEditingInvoice(inv); }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-blue-50 hover:text-blue-600" title={en ? "Edit" : "تعديل"}>
                          <Pencil size={12} />
                          <span>{en ? "Edit" : "تعديل"}</span>
                        </button>
                        <DeleteBtn id={inv.id} en={en} onDone={load} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingInvoice && (
        <EditInvoiceModal
          companyId={companyId}
          invoice={editingInvoice}
          en={en}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => {
            setEditingInvoice(null);
            setMessage(en ? "Invoice updated successfully" : "تم تعديل الفاتورة بنجاح");
            load();
          }}
          onViewImage={setViewImg}
        />
      )}

      {rejectingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{en ? "Reject invoice" : "رفض الفاتورة"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{en ? "Provide a clear reason for the driver or employee." : "أدخل سبباً واضحاً للسائق أو الموظف."}</p>
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} className="input-field mt-4 min-h-28 w-full" placeholder={en ? "Rejection reason" : "سبب الرفض"} />
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={reviewingId === rejectingInvoice.id} onClick={() => { setRejectingInvoice(null); setRejectionReason(""); }} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{en ? "Cancel" : "إلغاء"}</button>
              <button disabled={reviewingId === rejectingInvoice.id || rejectionReason.trim().length < 3} onClick={() => review(rejectingInvoice, "REJECTED", rejectionReason)} className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">{reviewingId === rejectingInvoice.id ? (en ? "Saving..." : "جارٍ الحفظ...") : (en ? "Reject" : "رفض")}</button>
            </div>
          </div>
        </div>
      )}

      {viewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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

  return (
    <button onClick={del} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title={en ? "Delete" : "حذف"}>
      <Trash2 size={13} />
    </button>
  );
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
    loadPeople(companyId, type).then(setPeople);
  }, [open, type, companyId]);

  function openModal(multi: boolean) {
    setType("DRIVER");
    setRows(multi ? [emptyRow(), emptyRow()] : [emptyRow()]);
    setError("");
    setOpen(true);
  }

  async function processRowFile(targetKey: string, file: File) {
    const text = await runOcr(file);
    const { amount, date } = parseInvoiceText(text);
    setRows((prev) => prev.map((row) => {
      if (!row.file || fileKey(row.file) !== targetKey) return row;
      return {
        ...row,
        ocrBusy: false,
        ocrText: text,
        ocrAmount: amount,
        ocrDate: date,
        ocrFailed: !text || (amount == null && !date),
        amount: row.amount || (amount != null ? String(amount) : ""),
        date: row.date || date || "",
      };
    }));
  }

  function pickFiles(index: number, files: FileList | null) {
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    const existing = new Set(rows.filter((row) => row.file).map((row) => fileKey(row.file!)));
    const freshFiles = selected.filter((file) => !existing.has(fileKey(file)));
    if (freshFiles.length === 0) return;

    const preparedRows = freshFiles.map((file) => ({
      ...emptyRow(),
      file,
      preview: URL.createObjectURL(file),
      ocrBusy: true,
    }));

    setRows((prev) => {
      const next = [...prev];
      const targetRow = next[index];
      const targetEmpty = targetRow && !targetRow.file && !targetRow.preview && !targetRow.date && !targetRow.amount && !targetRow.notes;

      if (targetEmpty) {
        next[index] = preparedRows[0];
        if (preparedRows.length > 1) next.splice(index + 1, 0, ...preparedRows.slice(1));
        return next;
      }

      return [...next, ...preparedRows];
    });

    for (const file of freshFiles) {
      void processRowFile(fileKey(file), file);
    }
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, rowIndex) => rowIndex !== index) : prev));
  }

  async function save() {
    if (!personId) {
      setError(en ? "Select a person" : "اختر السائق/الموظف");
      return;
    }

    const rowsWithFiles = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.file);

    if (rowsWithFiles.length === 0) {
      setError(en ? "Add at least one invoice image" : "أضف صورة فاتورة واحدة على الأقل");
      return;
    }

    const incomplete = rowsWithFiles
      .filter(({ row }) => !row.date || !row.amount)
      .map(({ index }) => index + 1);

    if (incomplete.length > 0) {
      setError(
        en
          ? `Complete invoices: ${incomplete.join(", ")}`
          : `أكمل بيانات الفواتير: ${incomplete.join("، ")}`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      for (const { row, index } of rowsWithFiles) {
        const fd = new FormData();
        fd.append("file", row.file!);
        fd.append("companyId", companyId);
        fd.append("targetType", type);
        fd.append(type === "DRIVER" ? "driverId" : "employeeId", personId);
        fd.append("invoiceDate", row.date);
        fd.append("amount", row.amount);
        if (row.notes) fd.append("notes", row.notes);
        if (row.ocrText) fd.append("ocrText", row.ocrText);
        if (row.ocrAmount != null) fd.append("ocrAmount", String(row.ocrAmount));
        if (row.ocrDate) fd.append("ocrDate", row.ocrDate);

        const res = await fetch("/api/delivery/invoices", { method: "POST", body: fd });
        const payload = await res.json();
        if (!payload.success) {
          setError(
            en
              ? `Invoice ${index + 1}: ${payload.error ?? "Failed to save"}`
              : `فاتورة ${index + 1}: ${payload.error ?? "فشل الحفظ"}`
          );
          setSaving(false);
          return;
        }
      }

      setOpen(false);
      onSaved();
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
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
                  {people.map((person) => <option key={person.id} value={person.id}>{en ? person.nameEn ?? person.nameAr : person.nameAr}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">{en ? `Invoice ${index + 1}` : `فاتورة ${index + 1}`}</span>
                    {rows.length > 1 && <button onClick={() => removeRow(index)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">{en ? "Invoice image *" : "صورة الفاتورة *"}</label>
                      <input type="file" accept="image/*" multiple onChange={(e) => pickFiles(index, e.target.files)} className="block w-full text-xs" />
                      {row.preview && (
                        <div className="mt-2 flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.preview} alt="preview" className="h-14 w-14 rounded border object-cover" />
                          {row.ocrBusy && <span className="text-xs text-amber-600">{en ? "Extracting..." : "جاري الاستخراج..."}</span>}
                          {!row.ocrBusy && !row.ocrFailed && row.ocrText && <span className="text-xs text-emerald-600">{en ? "Extracted (review)" : "تم الاستخراج (راجع)"}</span>}
                          {!row.ocrBusy && row.ocrFailed && <span className="text-xs text-amber-600">{en ? "Could not extract, enter manually" : "لم يتم الاستخراج، أدخل البيانات يدويًا"}</span>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Date *" : "التاريخ *"}</label><input type="date" value={row.date} onChange={(e) => updateRow(index, { date: e.target.value })} className="input-field w-full text-sm" dir="ltr" /></div>
                      <div><label className="mb-1 block text-xs text-muted-foreground">{en ? "Amount *" : "القيمة *"}</label><input type="number" step="0.001" value={row.amount} onChange={(e) => updateRow(index, { amount: e.target.value })} className="input-field w-full text-sm" dir="ltr" /></div>
                      <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">{en ? "Notes" : "ملاحظات"}</label><input value={row.notes} onChange={(e) => updateRow(index, { notes: e.target.value })} className="input-field w-full text-sm" /></div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addRow} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"><ImageIcon size={13} />{en ? "Add another image" : "إضافة صورة أخرى"}</button>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? (en ? "Saving..." : "جاري الحفظ...") : en ? "Save" : "حفظ"}</button>
              <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Cancel" : "إلغاء"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditInvoiceModal({
  companyId,
  invoice,
  en,
  onClose,
  onSaved,
  onViewImage,
}: {
  companyId: string;
  invoice: Invoice;
  en: boolean;
  onClose: () => void;
  onSaved: () => void;
  onViewImage: (value: string) => void;
}) {
  const [type, setType] = useState<"DRIVER" | "EMPLOYEE">(invoice.targetType);
  const [personId, setPersonId] = useState(invoice.targetType === "DRIVER" ? (invoice.driverId ?? "") : (invoice.employeeId ?? ""));
  const [people, setPeople] = useState<Person[]>([]);
  const [date, setDate] = useState(invoice.invoiceDate.slice(0, 10));
  const [amount, setAmount] = useState(String(invoice.amount));
  const [currency, setCurrency] = useState(invoice.currency || "KWD");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(invoice.imagePath);
  const [ocrText, setOcrText] = useState("");
  const [ocrAmount, setOcrAmount] = useState<number | null>(null);
  const [ocrDate, setOcrDate] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPeople(companyId, type).then(setPeople);
  }, [companyId, type]);

  async function onFileChange(nextFile: File | null) {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setOcrBusy(true);
    const text = await runOcr(nextFile);
    const parsed = parseInvoiceText(text);
    setOcrBusy(false);
    setOcrText(text);
    setOcrAmount(parsed.amount);
    setOcrDate(parsed.date);
    if (parsed.amount != null) setAmount(String(parsed.amount));
    if (parsed.date) setDate(parsed.date);
  }

  async function save() {
    if (!personId) {
      setError(en ? "Select a person" : "اختر السائق/الموظف");
      return;
    }
    if (!date) {
      setError(en ? "Date is required" : "تاريخ الفاتورة مطلوب");
      return;
    }
    if (amount === "" || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      setError(en ? "Enter a valid amount" : "أدخل قيمة صحيحة");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("targetType", type);
      fd.append("driverId", type === "DRIVER" ? personId : "");
      fd.append("employeeId", type === "EMPLOYEE" ? personId : "");
      fd.append("invoiceDate", date);
      fd.append("amount", amount);
      fd.append("currency", currency);
      fd.append("notes", notes);
      if (file) {
        fd.append("file", file);
        if (ocrText) fd.append("ocrText", ocrText);
        if (ocrAmount != null) fd.append("ocrAmount", String(ocrAmount));
        if (ocrDate) fd.append("ocrDate", ocrDate);
      }

      const response = await fetch(`/api/delivery/invoices/${invoice.id}`, { method: "PATCH", body: fd });
      const payload = await response.json();
      if (!payload.success) {
        setError(payload.error ?? (en ? "Failed to update invoice" : "فشل تعديل الفاتورة"));
        setSaving(false);
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-2xl space-y-4 rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{en ? "Edit invoice" : "تعديل الفاتورة"}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">{en ? "Type" : "النوع"}</label>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as "DRIVER" | "EMPLOYEE";
                setType(nextType);
                setPersonId("");
              }}
              className="input-field w-full text-sm"
            >
              <option value="DRIVER">{en ? "Driver" : "سائق"}</option>
              <option value="EMPLOYEE">{en ? "Employee" : "موظف"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{type === "DRIVER" ? (en ? "Driver" : "السائق") : en ? "Employee" : "الموظف"}</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="input-field w-full text-sm">
              <option value="">{en ? "Select..." : "اختر..."}</option>
              {people.map((person) => <option key={person.id} value={person.id}>{en ? person.nameEn ?? person.nameAr : person.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Date" : "تاريخ الفاتورة"}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Amount" : "قيمة الفاتورة"}</label>
            <input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Currency" : "العملة"}</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field w-full text-sm" dir="ltr" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Notes" : "الملاحظات"}</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field w-full text-sm" />
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{en ? "Current invoice image" : "صورة الفاتورة الحالية"}</span>
            <button onClick={() => onViewImage(preview)} className="rounded-lg border px-3 py-1 text-xs hover:bg-muted">{en ? "View" : "عرض"}</button>
          </div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="invoice-preview" className="h-20 w-20 rounded border object-cover" />
            <div className="flex-1 space-y-2">
              <input type="file" accept="image/*" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
              <p className="text-xs text-muted-foreground">
                {en ? "Optional: upload a new image to replace the current one after successful save." : "اختياري: ارفع صورة جديدة ليتم اعتمادها بعد نجاح الحفظ."}
              </p>
              {ocrBusy && <p className="text-xs text-amber-600">{en ? "Extracting OCR suggestions..." : "جاري استخراج اقتراحات OCR..."}</p>}
              {!ocrBusy && file && <p className="text-xs text-emerald-600">{en ? "OCR suggestions loaded. Review before saving." : "تم تحميل اقتراحات OCR. راجعها قبل الحفظ."}</p>}
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? (en ? "Saving..." : "جاري الحفظ...") : en ? "Save changes" : "حفظ التعديل"}
          </button>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{en ? "Cancel" : "إلغاء"}</button>
        </div>
      </div>
    </div>
  );
}
