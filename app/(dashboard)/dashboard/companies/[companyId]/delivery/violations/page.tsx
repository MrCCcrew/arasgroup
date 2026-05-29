"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Car, Plus, User, X } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Driver {
  id: string;
  employee: { nameAr: string; nameEn: string | null };
}

interface Vehicle {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
}

interface ExpenseCategory {
  id: string;
  nameAr: string;
}

interface Violation {
  id: string;
  driverId: string;
  vehicleId: string | null;
  date: string;
  locationAr: string | null;
  type: string;
  descriptionAr: string | null;
  amount: string;
  responsibility: string;
  driverSharePct: number | null;
  paymentMode: string;
  installmentMonths: number | null;
  installmentsPaid: number;
  status: string;
  notes: string | null;
  driver: { employee: { nameAr: string; nameEn: string | null } };
  vehicle: { plateNumber: string; make: string | null; model: string | null } | null;
  expense: { id: string; amount: string; descriptionAr: string } | null;
}

const RESPONSIBILITY_LABELS: Record<string, string> = {
  DRIVER: "على السائق",
  COMPANY: "على الشركة",
  SPLIT: "مقسّمة",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد التسوية",
  SETTLED: "مسوّاة",
  CANCELLED: "ملغية",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const RESP_COLORS: Record<string, string> = {
  DRIVER: "bg-red-100 text-red-700",
  COMPANY: "bg-blue-100 text-blue-700",
  SPLIT: "bg-purple-100 text-purple-700",
};

const now = new Date();
const todayDatetime = `${now.toISOString().slice(0, 10)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

const EMPTY_FORM = {
  driverId: "",
  vehicleId: "",
  date: todayDatetime,
  locationAr: "",
  locationEn: "",
  type: "",
  descriptionAr: "",
  descriptionEn: "",
  amount: "",
  responsibility: "DRIVER",
  driverSharePct: "50",
  paymentMode: "FULL",
  installmentMonths: "3",
  notes: "",
  expenseCategoryId: "",
};

function formatKWD(n: number) {
  return n.toLocaleString("ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " د.ك";
}

export default function ViolationsPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDriverId, setFilterDriverId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"settle" | "cancel" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ companyId });
    if (filterStatus) params.set("status", filterStatus);
    if (filterDriverId) params.set("driverId", filterDriverId);
    const res = await fetch(`/api/delivery/violations?${params}`).then((r) => r.json());
    if (res.success) setViolations(res.data);
    setLoading(false);
  }, [companyId, filterStatus, filterDriverId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/vehicles?companyId=${companyId}&groupWide=true&activeOnly=true`).then((r) => r.json()),
      fetch(`/api/expenses/categories?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([driversRes, vehiclesRes, catsRes]) => {
      if (driversRes.success) setDrivers(driversRes.data);
      if (vehiclesRes.success) setVehicles(vehiclesRes.data);
      if (catsRes.success) setCategories(catsRes.data);
    });
  }, [companyId]);

  function f(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function save() {
    if (!form.driverId) { setFormError("يرجى اختيار السائق"); return; }
    if (!form.type.trim()) { setFormError("يرجى إدخال نوع المخالفة"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError("يرجى إدخال مبلغ المخالفة"); return; }
    if (form.responsibility !== "DRIVER" && !form.expenseCategoryId) {
      setFormError("يرجى اختيار فئة المصروف للجزء المحمّل على الشركة"); return;
    }
    setSaving(true); setFormError("");

    const body = {
      companyId,
      driverId: form.driverId,
      vehicleId: form.vehicleId || undefined,
      date: form.date,
      locationAr: form.locationAr || undefined,
      locationEn: form.locationEn || undefined,
      type: form.type,
      descriptionAr: form.descriptionAr || undefined,
      descriptionEn: form.descriptionEn || undefined,
      amount: Number(form.amount),
      responsibility: form.responsibility,
      driverSharePct: form.responsibility === "SPLIT" ? Number(form.driverSharePct) : undefined,
      paymentMode: form.paymentMode,
      installmentMonths: form.paymentMode === "INSTALLMENT" ? Number(form.installmentMonths) : undefined,
      notes: form.notes || undefined,
      expenseCategoryId: form.expenseCategoryId || undefined,
    };

    const res = await fetch("/api/delivery/violations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function doAction() {
    if (!actionId || !actionType) return;
    setActionLoading(true);
    const res = await fetch(`/api/delivery/violations/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: actionType === "settle" ? "SETTLED" : "CANCELLED" }),
    });
    setActionLoading(false);
    if (res.ok) { setActionId(null); setActionType(null); load(); }
  }

  const pending = violations.filter((v) => v.status === "PENDING").length;
  const totalPending = violations
    .filter((v) => v.status === "PENDING" && (v.responsibility === "DRIVER" || v.responsibility === "SPLIT"))
    .reduce((sum, v) => {
      const driverShare = v.responsibility === "SPLIT" ? (v.driverSharePct ?? 50) / 100 : 1;
      return sum + Number(v.amount) * driverShare;
    }, 0);

  return (
    <div>
      <Header
        title="مخالفات السائقين"
        subtitle="تتبع المخالفات المرورية وتحديد المسؤولية"
        companyId={companyId}
        actions={
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={16} />
            مخالفة جديدة
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي المخالفات</p>
            <p className="mt-1 text-2xl font-bold">{violations.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">قيد التسوية</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{pending}</p>
          </div>
          <div className="stat-card col-span-2">
            <p className="text-xs text-muted-foreground">إجمالي مستحق من السواقين</p>
            <p className="mt-1 text-xl font-bold text-red-600">{formatKWD(totalPending)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={filterDriverId} onChange={(e) => setFilterDriverId(e.target.value)} className="input-field">
            <option value="">كل السواقين</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.employee.nameAr}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : violations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle size={40} className="mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد مخالفات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>السائق</th>
                    <th>السيارة</th>
                    <th>نوع المخالفة</th>
                    <th>المكان</th>
                    <th>المبلغ</th>
                    <th>المسؤولية</th>
                    <th>طريقة السداد</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((v) => {
                    const driverShare = v.responsibility === "SPLIT" ? (v.driverSharePct ?? 50) / 100 : v.responsibility === "DRIVER" ? 1 : 0;
                    const driverAmount = Number(v.amount) * driverShare;
                    const totalInst = v.paymentMode === "INSTALLMENT" ? (v.installmentMonths ?? 1) : 1;
                    const remaining = totalInst - v.installmentsPaid;

                    return (
                      <tr key={v.id} className="hover:bg-muted/20">
                        <td className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(v.date).toLocaleString("ar-KW", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">{v.driver.employee.nameAr}</span>
                          </div>
                        </td>
                        <td className="text-sm">
                          {v.vehicle ? (
                            <div className="flex items-center gap-1.5">
                              <Car size={13} className="shrink-0 text-muted-foreground" />
                              <span>{v.vehicle.plateNumber}</span>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="font-medium text-sm">{v.type}</td>
                        <td className="text-sm text-muted-foreground">{v.locationAr ?? "—"}</td>
                        <td>
                          <div className="text-sm">
                            <p className="font-bold number">{formatKWD(Number(v.amount))}</p>
                            {driverAmount > 0 && driverAmount !== Number(v.amount) && (
                              <p className="text-xs text-red-600 number">سائق: {formatKWD(driverAmount)}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESP_COLORS[v.responsibility]}`}>
                            {RESPONSIBILITY_LABELS[v.responsibility]}
                            {v.responsibility === "SPLIT" && v.driverSharePct && ` (${v.driverSharePct}%)`}
                          </span>
                        </td>
                        <td className="text-sm">
                          {v.paymentMode === "INSTALLMENT" ? (
                            <div>
                              <span className="text-xs">أقساط {v.installmentMonths} شهر</span>
                              {v.status === "PENDING" && (
                                <p className="text-xs text-yellow-600">متبقي {remaining} قسط</p>
                              )}
                            </div>
                          ) : "دفعة واحدة"}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[v.status]}`}>
                            {STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td>
                          {v.status === "PENDING" && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setActionId(v.id); setActionType("settle"); }}
                                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                              >
                                تسوية
                              </button>
                              <button
                                onClick={() => { setActionId(v.id); setActionType("cancel"); }}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
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

      {/* New violation modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">تسجيل مخالفة جديدة</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              {/* السائق والسيارة */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">السائق <span className="text-red-500">*</span></label>
                  <select value={form.driverId} onChange={f("driverId")} className="input-field w-full">
                    <option value="">اختر السائق</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.employee.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">السيارة</label>
                  <select value={form.vehicleId} onChange={f("vehicleId")} className="input-field w-full">
                    <option value="">— بدون سيارة —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber}{v.make ? ` — ${v.make}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* التاريخ والمكان */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">تاريخ ووقت المخالفة <span className="text-red-500">*</span></label>
                  <input type="datetime-local" value={form.date} onChange={f("date")} className="input-field w-full" dir="ltr" />
                </div>
                <div>
                  <label className="form-label">الموقع</label>
                  <input type="text" value={form.locationAr} onChange={f("locationAr")} className="input-field w-full" placeholder="مثال: شارع الخليج، حولي" />
                </div>
              </div>

              {/* النوع والوصف */}
              <div>
                <label className="form-label">نوع المخالفة <span className="text-red-500">*</span></label>
                <input type="text" value={form.type} onChange={f("type")} className="input-field w-full"
                  placeholder="مثال: تجاوز سرعة، تخطي إشارة حمراء، وقوف مخالف..." />
              </div>
              <div>
                <label className="form-label">وصف تفصيلي</label>
                <textarea rows={2} value={form.descriptionAr} onChange={f("descriptionAr")} className="input-field w-full resize-none"
                  placeholder="تفاصيل إضافية عن المخالفة..." />
              </div>

              {/* المبلغ والمسؤولية */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">المبلغ (د.ك) <span className="text-red-500">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.amount} onChange={f("amount")} className="input-field w-full" dir="ltr" placeholder="0.000" />
                </div>
                <div>
                  <label className="form-label">من يتحمل المخالفة؟ <span className="text-red-500">*</span></label>
                  <select value={form.responsibility} onChange={f("responsibility")} className="input-field w-full">
                    <option value="DRIVER">السائق بالكامل</option>
                    <option value="COMPANY">الشركة بالكامل</option>
                    <option value="SPLIT">مقسّمة بين السائق والشركة</option>
                  </select>
                </div>
              </div>

              {/* نسبة التقسيم */}
              {form.responsibility === "SPLIT" && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <label className="form-label">نسبة السائق %</label>
                  <input type="number" min="1" max="99" value={form.driverSharePct} onChange={f("driverSharePct")} className="input-field w-32" dir="ltr" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    السائق: {form.amount ? (Number(form.amount) * Number(form.driverSharePct) / 100).toFixed(3) : "0.000"} د.ك
                    &nbsp;|&nbsp;
                    الشركة: {form.amount ? (Number(form.amount) * (100 - Number(form.driverSharePct)) / 100).toFixed(3) : "0.000"} د.ك
                  </p>
                </div>
              )}

              {/* فئة المصروف للشركة */}
              {(form.responsibility === "COMPANY" || form.responsibility === "SPLIT") && (
                <div>
                  <label className="form-label">فئة مصروف الشركة <span className="text-red-500">*</span></label>
                  <select value={form.expenseCategoryId} onChange={f("expenseCategoryId")} className="input-field w-full">
                    <option value="">اختر الفئة</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">سيتم ترحيل الجزء المحمّل على الشركة تلقائياً كمصروف.</p>
                </div>
              )}

              {/* طريقة سداد السائق */}
              {form.responsibility !== "COMPANY" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">طريقة خصم السائق</label>
                    <select value={form.paymentMode} onChange={f("paymentMode")} className="input-field w-full">
                      <option value="FULL">دفعة واحدة من الراتب</option>
                      <option value="INSTALLMENT">أقساط شهرية من الراتب</option>
                    </select>
                  </div>
                  {form.paymentMode === "INSTALLMENT" && (
                    <div>
                      <label className="form-label">عدد الأشهر</label>
                      <input type="number" min="1" max="12" value={form.installmentMonths} onChange={f("installmentMonths")} className="input-field w-full" dir="ltr" />
                      {form.amount && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          قسط شهري:{" "}
                          {(
                            (Number(form.amount) * (form.responsibility === "SPLIT" ? Number(form.driverSharePct) / 100 : 1))
                            / Number(form.installmentMonths)
                          ).toFixed(3)} د.ك
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="form-label">ملاحظات</label>
                <textarea rows={2} value={form.notes} onChange={f("notes")} className="input-field w-full resize-none" />
              </div>

              {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "جاري الحفظ..." : "حفظ المخالفة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settle / Cancel confirm */}
      {actionId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl">
            <p className="font-medium">
              {actionType === "settle" ? "تأكيد تسوية المخالفة؟" : "تأكيد إلغاء المخالفة؟"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {actionType === "settle"
                ? "سيتم تغيير الحالة إلى مسوّاة ولن تظهر في الخصومات المستقبلية."
                : "سيتم إلغاء المخالفة ولن تُحتسب في الرواتب."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setActionId(null); setActionType(null); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button
                onClick={doAction}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${actionType === "settle" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {actionLoading ? "جاري..." : actionType === "settle" ? "تسوية" : "إلغاء المخالفة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
