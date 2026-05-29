"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle, Users, Send, Ban, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";

interface DriverOption { id: string; employee: { nameAr: string; nameEn: string | null } }

interface Allocation {
  id: string;
  driverId: string;
  allocationType: string;
  allocatedOrders: string;
  percentage: string | null;
  notes: string | null;
  driver: { employee: { nameAr: string; nameEn: string | null } };
}

interface Rider {
  id: string;
  talabatRiderId: string;
  talabatRiderName: string;
  contractName: string | null;
  companyCode: string | null;
  rowCount: number;
  totalPickupPay: string;
  totalDropoffPay: string;
  calculatedOrdersRaw: string;
  calculatedOrdersRounded: string;
  totalPayment: string;
  totalDeductions: string;
  downgradedRowCount: number;
  downgradedPickupPay: string;
  downgradedDropoffPay: string;
  downgradedCalculatedOrders: string;
  downgradedTotalPayment: string;
  matchingStatus: string;
  matchedDriverId: string | null;
  matchedDriver: { employee: { nameAr: string; nameEn: string | null } } | null;
  allocations: Allocation[];
}

interface TalabatImport {
  id: string;
  companyId: string;
  month: number;
  year: number;
  fileName: string;
  status: string;
  orderRoundingMode: string;
  totalRows: number;
  totalRiders: number;
  totalPickupPay: string;
  totalDropoffPay: string;
  totalCalculatedOrders: string;
  totalPayment: string;
  contractSummaryFinalPayment: string | null;
  notes: string | null;
  contract: { nameAr: string; nameEn: string | null } | null;
  createdBy: { nameAr: string };
  riders: Rider[];
}

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const MATCH_LABELS: Record<string, { label: string; color: string }> = {
  UNMATCHED:                  { label: "غير مطابق",        color: "bg-red-100 text-red-700" },
  MATCHED:                    { label: "مطابق تلقائياً",   color: "bg-emerald-100 text-emerald-700" },
  SHARED_ID_NEEDS_ALLOCATION: { label: "كود مشترك",        color: "bg-yellow-100 text-yellow-700" },
  MANUALLY_ALLOCATED:         { label: "موزّع يدوياً",     color: "bg-blue-100 text-blue-700" },
};

function fmt3(n: string | number) {
  return Number(n).toLocaleString("ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function TalabatImportDetailPage() {
  const { companyId, importId } = useParams<{ companyId: string; importId: string }>();
  const [imp, setImp] = useState<TalabatImport | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [postConfirm, setPostConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Allocation modal state
  const [allocRider, setAllocRider] = useState<Rider | null>(null);
  const [allocLines, setAllocLines] = useState<{ driverId: string; orders: string; pct: string; notes: string }[]>([]);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocError, setAllocError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/delivery/talabat-imports/${importId}`).then(r => r.json());
    if (res.success) setImp(res.data);
    setLoading(false);
  }, [importId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`/api/delivery/drivers?companyId=${companyId}`).then(r => r.json()).then(r => {
      if (r.success) setDrivers(r.data);
    });
  }, [companyId]);

  function openAlloc(rider: Rider) {
    let existing;
    if (rider.allocations.length > 0) {
      existing = rider.allocations.map(a => ({ driverId: a.driverId, orders: Number(a.allocatedOrders).toFixed(3), pct: a.percentage ?? "", notes: a.notes ?? "" }));
    } else if (rider.downgradedRowCount > 0) {
      // Split: owner driver keeps own orders, downgraded portion goes to a substitute driver
      const total = Number(rider.calculatedOrdersRounded);
      const downgraded = Number(rider.downgradedCalculatedOrders);
      const ownOrders = Math.max(0, total - downgraded);
      existing = [
        { driverId: rider.matchedDriverId ?? "", orders: ownOrders.toFixed(3), pct: "", notes: "" },
        { driverId: "", orders: downgraded.toFixed(3), pct: "", notes: "صفوف مخفّضة (Downgraded)" },
      ];
    } else {
      existing = [{ driverId: rider.matchedDriverId ?? "", orders: Number(rider.calculatedOrdersRounded).toFixed(3), pct: "", notes: "" }];
    }
    setAllocLines(existing);
    setAllocRider(rider);
    setAllocError("");
  }

  const allocTotal = allocLines.reduce((s, l) => s + (parseFloat(l.orders) || 0), 0);
  const allocExpected = allocRider ? Number(allocRider.calculatedOrdersRounded) : 0;
  const allocDiff = Math.abs(allocTotal - allocExpected);

  async function saveAlloc() {
    if (!allocRider) return;
    if (allocDiff > 0.001) {
      setAllocError(`إجمالي الموزّع (${allocTotal.toFixed(3)}) يجب أن يساوي (${allocExpected.toFixed(3)})`);
      return;
    }
    if (allocLines.some(l => !l.driverId)) {
      setAllocError("يرجى اختيار السائق لكل سطر");
      return;
    }
    setAllocSaving(true); setAllocError("");
    const res = await fetch(`/api/delivery/talabat-imports/${importId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importRiderId: allocRider.id,
        allocations: allocLines.map(l => ({
          driverId: l.driverId,
          allocationType: "MANUAL_FIXED",
          allocatedOrders: parseFloat(l.orders) || 0,
          notes: l.notes || undefined,
        })),
      }),
    });
    const data = await res.json();
    setAllocSaving(false);
    if (!data.success) { setAllocError(data.error ?? "فشل في الحفظ"); return; }
    setAllocRider(null);
    load();
  }

  async function doPost(force = false) {
    setPosting(true); setPostError("");
    const res = await fetch(`/api/delivery/talabat-imports/${importId}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceReplace: force }),
    });
    const data = await res.json();
    setPosting(false);
    if (data.needsConfirmation) { setPostConfirm(true); return; }
    if (!data.success) { setPostError(data.error ?? "فشل الترحيل"); return; }
    setPostConfirm(false);
    load();
  }

  async function doCancel() {
    await fetch(`/api/delivery/talabat-imports/${importId}/cancel`, { method: "POST" });
    setCancelConfirm(false);
    load();
  }

  if (loading || !imp) {
    return <div className="page-container py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>;
  }

  const unresolved = imp.riders.filter(r => r.matchingStatus === "UNMATCHED" || r.matchingStatus === "SHARED_ID_NEEDS_ALLOCATION");
  const canPost = imp.status !== "POSTED" && imp.status !== "CANCELLED" && unresolved.length === 0;
  const totalDataPayment = Number(imp.totalPayment);
  const totalSummaryPayment = imp.contractSummaryFinalPayment ? Number(imp.contractSummaryFinalPayment) : null;
  const paymentDiff = totalSummaryPayment !== null ? totalDataPayment - totalSummaryPayment : null;

  return (
    <div>
      <Header
        title={`تقرير طلبات — ${MONTHS_AR[imp.month - 1]} ${imp.year}`}
        subtitle={imp.fileName}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            {imp.status !== "POSTED" && imp.status !== "CANCELLED" && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                <Ban size={14} />إلغاء
              </button>
            )}
            {canPost && (
              <button
                onClick={() => doPost(false)}
                disabled={posting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send size={14} />
                {posting ? "جاري الترحيل..." : "ترحيل للتقرير الشهري"}
              </button>
            )}
          </div>
        }
      />

      <div className="page-container space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/talabat-imports`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />العودة للتقارير
        </Link>

        {postError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{postError}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { label: "الصفوف", value: imp.totalRows.toString() },
            { label: "السائقون", value: imp.totalRiders.toString() },
            { label: "Pickup Pay", value: fmt3(imp.totalPickupPay) },
            { label: "Dropoff Pay", value: fmt3(imp.totalDropoffPay) },
            { label: "إجمالي الطلبات", value: fmt3(imp.totalCalculatedOrders), bold: true },
            { label: "دفع Data", value: fmt3(imp.totalPayment) },
            totalSummaryPayment !== null ? { label: "Final Payment", value: fmt3(totalSummaryPayment), warn: Math.abs(paymentDiff!) > 0.01 } : null,
            totalSummaryPayment !== null && paymentDiff !== null ? { label: "الفرق", value: fmt3(paymentDiff), warn: Math.abs(paymentDiff) > 0.01, color: Math.abs(paymentDiff) > 0.01 ? "text-red-600" : "text-emerald-600" } : null,
          ].filter(Boolean).map((s, i) => s && (
            <div key={i} className="stat-card p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-sm font-bold number ${s.color ?? ""} ${s.bold ? "text-primary text-lg" : ""}`}>
                {s.warn && <AlertTriangle size={12} className="inline mr-1 text-yellow-500" />}
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {unresolved.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <AlertTriangle size={16} />
            يوجد {unresolved.length} سائق غير مطابق — يجب توزيع طلباتهم قبل الترحيل.
          </div>
        )}

        {/* Riders Table */}
        <div>
          <h2 className="mb-3 text-base font-bold flex items-center gap-2">
            <Users size={16} />السائقون في التقرير
          </h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>كود طلبات</th>
                    <th>اسم السائق في طلبات</th>
                    <th>الصفوف</th>
                    <th>Pickup Pay</th>
                    <th>Dropoff Pay</th>
                    <th>الطلبات المحسوب</th>
                    <th>الدفع الكلي</th>
                    <th>حالة المطابقة</th>
                    <th>السائق المرتبط</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {imp.riders.map((rider) => {
                    const ms = MATCH_LABELS[rider.matchingStatus] ?? MATCH_LABELS.UNMATCHED;
                    const linkedDrivers = rider.allocations.length > 0
                      ? rider.allocations.map(a => a.driver.employee.nameAr).join("، ")
                      : rider.matchedDriver?.employee.nameAr ?? "—";

                    return (
                      <tr key={rider.id} className={`hover:bg-muted/20 ${rider.matchingStatus === "UNMATCHED" ? "bg-red-50/30" : ""}`}>
                        <td className="font-mono text-sm font-medium">{rider.talabatRiderId}</td>
                        <td className="text-sm">
                          {rider.talabatRiderName}
                          {rider.downgradedRowCount > 0 && (
                            <span
                              className="mr-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
                              title={`${rider.downgradedRowCount} صف مخفّض — ${fmt3(rider.downgradedCalculatedOrders)} طلب عملها سائق بديل`}
                            >
                              مخفّض: {fmt3(rider.downgradedCalculatedOrders)}
                            </span>
                          )}
                        </td>
                        <td className="text-center text-sm">{rider.rowCount}</td>
                        <td className="number text-sm">{fmt3(rider.totalPickupPay)}</td>
                        <td className="number text-sm">{fmt3(rider.totalDropoffPay)}</td>
                        <td className="number font-bold text-primary">{fmt3(rider.calculatedOrdersRounded)}</td>
                        <td className="number text-sm">{fmt3(rider.totalPayment)}</td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ms.color}`}>
                            {ms.label}
                          </span>
                          {rider.allocations.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {rider.allocations.length} توزيع
                            </p>
                          )}
                        </td>
                        <td className="text-sm max-w-36 truncate">{linkedDrivers}</td>
                        <td>
                          {imp.status !== "POSTED" && imp.status !== "CANCELLED" && (
                            <button
                              onClick={() => openAlloc(rider)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                            >
                              <Users size={12} />
                              توزيع الطلبات
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Modal */}
      {allocRider && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10" onClick={() => setAllocRider(null)}>
          <div className="w-full max-w-xl rounded-xl bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">توزيع الطلبات</h2>
              <p className="text-sm text-muted-foreground">
                {allocRider.talabatRiderName} ({allocRider.talabatRiderId}) —
                إجمالي: <span className="font-bold text-primary number">{fmt3(allocRider.calculatedOrdersRounded)}</span> طلب
              </p>
            </div>
            <div className="space-y-4 p-5">
              {allocRider.downgradedRowCount > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <p className="font-medium">⚠️ يحتوي على صفوف مخفّضة (Downgraded)</p>
                  <p className="mt-1 text-xs">
                    {allocRider.downgradedRowCount} صف بإجمالي{" "}
                    <strong className="number">{fmt3(allocRider.downgradedCalculatedOrders)}</strong> طلب
                    عملها سائق بديل تحت كود هذا الراكب. تم تجهيز سطر منفصل لها — اختر السائق البديل الذي قام بها.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {allocLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {i === 0 && <label className="form-label text-xs">السائق</label>}
                      <select
                        value={line.driverId}
                        onChange={e => {
                          const next = [...allocLines];
                          next[i] = { ...next[i], driverId: e.target.value };
                          setAllocLines(next);
                        }}
                        className="input-field w-full text-sm"
                      >
                        <option value="">اختر السائق</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.employee.nameAr}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className="form-label text-xs">الطلبات</label>}
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={line.orders}
                        onChange={e => {
                          const next = [...allocLines];
                          next[i] = { ...next[i], orders: e.target.value };
                          setAllocLines(next);
                        }}
                        className="input-field w-full text-sm"
                        dir="ltr"
                      />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className="form-label text-xs">ملاحظات</label>}
                      <input
                        type="text"
                        value={line.notes}
                        onChange={e => {
                          const next = [...allocLines];
                          next[i] = { ...next[i], notes: e.target.value };
                          setAllocLines(next);
                        }}
                        className="input-field w-full text-sm"
                        placeholder="اختياري"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {allocLines.length > 1 && (
                        <button type="button" onClick={() => setAllocLines(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAllocLines(prev => [...prev, { driverId: "", orders: "0.000", pct: "", notes: "" }])}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus size={14} />إضافة سائق آخر
              </button>

              {/* Live remaining */}
              <div className={`rounded-lg p-3 text-sm ${allocDiff <= 0.001 ? "bg-emerald-50 text-emerald-700" : "bg-yellow-50 text-yellow-700"}`}>
                <span>إجمالي الموزّع: <strong className="number">{allocTotal.toFixed(3)}</strong></span>
                <span className="mr-3">المطلوب: <strong className="number">{allocExpected.toFixed(3)}</strong></span>
                <span className="mr-3">المتبقي: <strong className="number">{(allocExpected - allocTotal).toFixed(3)}</strong></span>
              </div>

              {allocError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{allocError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAllocRider(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button
                  type="button"
                  onClick={saveAlloc}
                  disabled={allocSaving || allocDiff > 0.001}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {allocSaving ? "جاري الحفظ..." : "حفظ التوزيع"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post confirm (replace) */}
      {postConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl">
            <p className="font-medium">استبدال بيانات طلبات الموجودة؟</p>
            <p className="mt-1 text-sm text-muted-foreground">يوجد تقرير طلبات مرحّل بالفعل لهذا الشهر. هل تريد استبداله بالبيانات الجديدة؟</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPostConfirm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => doPost(true)} disabled={posting} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
                {posting ? "جاري..." : "استبدال وترحيل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl">
            <p className="font-medium">تأكيد إلغاء التقرير؟</p>
            <p className="mt-1 text-sm text-muted-foreground">لن يمكن ترحيله بعد الإلغاء.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCancelConfirm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">رجوع</button>
              <button onClick={doCancel} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">إلغاء التقرير</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
