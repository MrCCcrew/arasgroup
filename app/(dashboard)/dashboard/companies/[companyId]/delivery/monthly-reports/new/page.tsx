"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

interface Contract { id: string; nameAr: string; platform: string }
interface Driver {
  id: string;
  employee: { nameAr: string };
}

interface ReportLine {
  driverId: string;
  ordersCount: number;
  ratePerOrder: number;
  grossAmount: number;
  walletDeducted: number;
  netAmount: number;
  notes: string;
}

const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const now = new Date();

const emptyLine = (): ReportLine => ({
  driverId: "", ordersCount: 0, ratePerOrder: 0,
  grossAmount: 0, walletDeducted: 0, netAmount: 0, notes: "",
});

export default function NewMonthlyReportPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const [contractId, setContractId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reportDate, setReportDate] = useState(now.toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReportLine[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/delivery/contracts?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([c, d]) => {
      if (c.success) setContracts(c.data);
      if (d.success) setDrivers(d.data);
      setLoading(false);
    });
  }, [companyId]);

  function updateLine(index: number, field: keyof ReportLine, value: string | number) {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calc net
      if (field === "grossAmount" || field === "walletDeducted") {
        const g = field === "grossAmount" ? Number(value) : updated[index].grossAmount;
        const w = field === "walletDeducted" ? Number(value) : updated[index].walletDeducted;
        updated[index].netAmount = Math.max(0, g - w);
      }
      // Auto-calc gross from orders × rate
      if (field === "ordersCount" || field === "ratePerOrder") {
        const o = field === "ordersCount" ? Number(value) : updated[index].ordersCount;
        const r = field === "ratePerOrder" ? Number(value) : updated[index].ratePerOrder;
        updated[index].grossAmount = Math.round(o * r * 1000) / 1000;
        updated[index].netAmount = Math.max(0, updated[index].grossAmount - updated[index].walletDeducted);
      }
      return updated;
    });
  }

  function addLine() { setLines((p) => [...p, emptyLine()]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, idx) => idx !== i)); }

  const totalOrders = lines.reduce((s, l) => s + l.ordersCount, 0);
  const totalGross = lines.reduce((s, l) => s + l.grossAmount, 0);
  const totalWallet = lines.reduce((s, l) => s + l.walletDeducted, 0);
  const totalNet = lines.reduce((s, l) => s + l.netAmount, 0);

  async function save() {
    if (!contractId) { setError("اختر العقد"); return; }
    const validLines = lines.filter((l) => l.driverId);
    if (validLines.length === 0) { setError("أضف سطراً واحداً على الأقل"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/delivery/monthly-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId, companyId, month, year,
        reportDate, notes: notes || undefined,
        lines: validLines,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setError(data.error ?? "حدث خطأ"); return; }
    router.push(`/dashboard/companies/${companyId}/delivery/monthly-reports`);
  }

  if (loading) return <div className="page-container py-20 text-center text-sm text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/companies/${companyId}/delivery/monthly-reports`} className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold">تقرير شهري جديد</h1>
            <p className="text-sm text-muted-foreground">إدخال بيانات التوصيل الشهرية للسائقين</p>
          </div>
        </div>
      </div>

      <div className="page-container space-y-6">
        {/* Header fields */}
        <div className="section-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">بيانات التقرير</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="form-label">العقد / المنصة *</label>
              <select className="input-field" value={contractId} onChange={(e) => setContractId(e.target.value)}>
                <option value="">— اختر العقد —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameAr} ({c.platform})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">الشهر</label>
              <select className="input-field" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">السنة</label>
              <input type="number" className="input-field" value={year}
                onChange={(e) => setYear(Number(e.target.value))} min={2020} max={2100} />
            </div>
            <div>
              <label className="form-label">تاريخ التقرير</label>
              <input type="date" className="input-field" value={reportDate}
                onChange={(e) => setReportDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">ملاحظات</label>
            <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Driver lines */}
        <div className="section-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">بيانات السائقين</h2>
            <button onClick={addLine} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
              <Plus size={14} /> إضافة سائق
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-right font-medium">السائق</th>
                  <th className="px-3 py-2 text-center font-medium">الطلبات</th>
                  <th className="px-3 py-2 text-center font-medium">سعر الطلب</th>
                  <th className="px-3 py-2 text-center font-medium">الإجمالي</th>
                  <th className="px-3 py-2 text-center font-medium">خصم المحفظة</th>
                  <th className="px-3 py-2 text-center font-medium">الصافي</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-2">
                      <select
                        className="input-field min-w-36"
                        value={line.driverId}
                        onChange={(e) => updateLine(i, "driverId", e.target.value)}
                      >
                        <option value="">— اختر —</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.employee.nameAr}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" className="input-field w-20 text-center"
                        value={line.ordersCount || ""}
                        onChange={(e) => updateLine(i, "ordersCount", Number(e.target.value))} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="0.001" className="input-field w-24 text-center"
                        value={line.ratePerOrder || ""}
                        onChange={(e) => updateLine(i, "ratePerOrder", Number(e.target.value))} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="0.001" className="input-field w-28 text-center"
                        value={line.grossAmount || ""}
                        onChange={(e) => updateLine(i, "grossAmount", Number(e.target.value))} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="0.001" className="input-field w-28 text-center"
                        value={line.walletDeducted || ""}
                        onChange={(e) => updateLine(i, "walletDeducted", Number(e.target.value))} />
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-green-600 number">
                      {line.netAmount.toFixed(3)}
                    </td>
                    <td className="px-2 py-2">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30 font-bold">
                <tr>
                  <td className="px-3 py-2">الإجمالي</td>
                  <td className="px-3 py-2 text-center number">{totalOrders}</td>
                  <td></td>
                  <td className="px-3 py-2 text-center number">{totalGross.toFixed(3)}</td>
                  <td className="px-3 py-2 text-center number text-orange-600">{totalWallet.toFixed(3)}</td>
                  <td className="px-3 py-2 text-center number text-green-600">{totalNet.toFixed(3)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pb-6">
          <Link
            href={`/dashboard/companies/${companyId}/delivery/monthly-reports`}
            className="rounded-lg border px-5 py-2 text-sm hover:bg-muted"
          >
            إلغاء
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التقرير"}
          </button>
        </div>
      </div>
    </div>
  );
}
