"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Upload, X, FileSpreadsheet, CheckCircle, Clock, AlertTriangle, Ban } from "lucide-react";
import { Header } from "@/components/layout/header";

interface TalabatImport {
  id: string;
  month: number;
  year: number;
  fileName: string;
  status: string;
  totalRiders: number;
  totalCalculatedOrders: string;
  totalPickupPay: string;
  totalDropoffPay: string;
  totalPayment: string;
  contractSummaryFinalPayment: string | null;
  orderRoundingMode: string;
  createdAt: string;
  contract: { nameAr: string } | null;
  createdBy: { nameAr: string };
  _count: { riders: number };
}

interface Contract { id: string; nameAr: string; }

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const STATUS_UI: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:     { label: "مسودة",   color: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  MATCHED:   { label: "مطابق",   color: "bg-blue-100 text-blue-700",    icon: <CheckCircle size={12} /> },
  ALLOCATED: { label: "موزّع",   color: "bg-purple-100 text-purple-700", icon: <CheckCircle size={12} /> },
  POSTED:    { label: "مرحّل",   color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle size={12} /> },
  CANCELLED: { label: "ملغي",    color: "bg-gray-100 text-gray-500",    icon: <Ban size={12} /> },
};

const ROUNDING_LABELS: Record<string, string> = {
  NONE: "بدون تقريب",
  DECIMAL_2: "رقمين عشريين",
  INTEGER: "أقرب صحيح",
};

function fmt(n: string | number) {
  return Number(n).toLocaleString("ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function TalabatImportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [imports, setImports] = useState<TalabatImport[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [form, setForm] = useState({
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    contractId: "",
    orderRoundingMode: "DECIMAL_2",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/delivery/talabat-imports?companyId=${companyId}`).then(r => r.json());
    if (res.success) setImports(res.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`/api/delivery/contracts?companyId=${companyId}`).then(r => r.json()).then(r => {
      if (r.success) setContracts(r.data);
    });
  }, [companyId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError(["يرجى اختيار ملف"]); return; }
    setUploading(true); setUploadError([]); setUploadWarnings([]);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("companyId", companyId);
    fd.append("month", form.month);
    fd.append("year", form.year);
    fd.append("orderRoundingMode", form.orderRoundingMode);
    if (form.contractId) fd.append("contractId", form.contractId);

    const res = await fetch("/api/delivery/talabat-imports", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!data.success) {
      setUploadError(data.errors ?? [data.error ?? "فشل في الرفع"]);
      return;
    }
    if (data.warnings?.length) setUploadWarnings(data.warnings);
    setShowUpload(false);
    load();
    // Navigate to import detail
    window.location.href = `/dashboard/companies/${companyId}/delivery/talabat-imports/${data.data.id}`;
  }

  return (
    <div>
      <Header
        title="تقارير طلبات المرفوعة"
        subtitle="رفع ومعالجة تقارير Excel من طلبات"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setShowUpload(true); setUploadError([]); setUploadWarnings([]); }}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <Upload size={16} />
            رفع تقرير طلبات
          </button>
        }
      />

      <div className="page-container space-y-4">
        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileSpreadsheet size={40} className="text-muted-foreground" />
              <p className="text-muted-foreground">لم يتم رفع أي تقرير طلبات بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>الشهر / السنة</th>
                    <th>اسم الملف</th>
                    <th>العقد</th>
                    <th>السائقون</th>
                    <th>إجمالي الطلبات المحسوب</th>
                    <th>Pickup Pay</th>
                    <th>Dropoff Pay</th>
                    <th>الدفع الكلي</th>
                    <th>الحالة</th>
                    <th>بواسطة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => {
                    const st = STATUS_UI[imp.status] ?? STATUS_UI.DRAFT;
                    const diff = imp.contractSummaryFinalPayment
                      ? Math.abs(Number(imp.totalPayment) - Number(imp.contractSummaryFinalPayment))
                      : null;
                    return (
                      <tr key={imp.id} className="hover:bg-muted/20">
                        <td className="font-medium">{MONTHS_AR[imp.month - 1]} {imp.year}</td>
                        <td className="text-xs text-muted-foreground max-w-40 truncate">{imp.fileName}</td>
                        <td className="text-sm">{imp.contract?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="text-center number">{imp.totalRiders}</td>
                        <td className="number font-bold text-primary">{fmt(imp.totalCalculatedOrders)}</td>
                        <td className="number text-sm">{fmt(imp.totalPickupPay)}</td>
                        <td className="number text-sm">{fmt(imp.totalDropoffPay)}</td>
                        <td className="number text-sm">
                          <span>{fmt(imp.totalPayment)}</span>
                          {diff !== null && diff > 0.01 && (
                            <AlertTriangle size={12} className="inline mr-1 text-yellow-500" />
                          )}
                        </td>
                        <td>
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs w-fit ${st.color}`}>
                            {st.icon}{st.label}
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">{imp.createdBy.nameAr}</td>
                        <td>
                          <Link
                            href={`/dashboard/companies/${companyId}/delivery/talabat-imports/${imp.id}`}
                            className="rounded px-2 py-1 text-xs text-primary hover:underline"
                          >
                            عرض
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">رفع تقرير طلبات</h2>
              <button onClick={() => setShowUpload(false)} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الشهر <span className="text-red-500">*</span></label>
                  <select value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} className="input-field w-full">
                    {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">السنة <span className="text-red-500">*</span></label>
                  <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} className="input-field w-full">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">العقد</label>
                <select value={form.contractId} onChange={e => setForm(p => ({ ...p, contractId: e.target.value }))} className="input-field w-full">
                  <option value="">— اختر العقد (اختياري) —</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">تقريب الطلبات</label>
                <select value={form.orderRoundingMode} onChange={e => setForm(p => ({ ...p, orderRoundingMode: e.target.value }))} className="input-field w-full">
                  {Object.entries(ROUNDING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  الصيغة: (إجمالي Pickup Pay + إجمالي Dropoff Pay) ÷ 1.050
                </p>
              </div>

              <div>
                <label className="form-label">ملف Excel (.xlsx) <span className="text-red-500">*</span></label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:px-3 file:py-1.5 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 file:border-orange-200 hover:file:bg-orange-100"
                />
              </div>

              {uploadError.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                  {uploadError.map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
                </div>
              )}
              {uploadWarnings.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-1">
                  {uploadWarnings.map((w, i) => <p key={i} className="text-xs text-yellow-700">{w}</p>)}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowUpload(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button type="submit" disabled={uploading} className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                  <Upload size={14} />
                  {uploading ? "جاري المعالجة..." : "رفع ومعالجة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
