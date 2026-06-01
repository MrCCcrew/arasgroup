"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Car, Plus, Trash2, User, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

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

const RESPONSIBILITY_LABELS: Record<string, { ar: string; en: string }> = {
  DRIVER: { ar: "على السائق", en: "On driver" },
  COMPANY: { ar: "على الشركة", en: "On company" },
  SPLIT: { ar: "مقسّمة", en: "Split" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: "قيد التسوية", en: "Pending" },
  SETTLED: { ar: "مسوّاة", en: "Settled" },
  CANCELLED: { ar: "ملغية", en: "Cancelled" },
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

function formatKWD(n: number, numberLocale: string, kwd: string) {
  return n.toLocaleString(numberLocale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " " + kwd;
}

export default function ViolationsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const kwd = en ? "KWD" : "د.ك";
  const fmt = (n: number) => formatKWD(n, numberLocale, kwd);
  const respLabel = (k: string) => RESPONSIBILITY_LABELS[k] ? (en ? RESPONSIBILITY_LABELS[k].en : RESPONSIBILITY_LABELS[k].ar) : k;
  const statusLabel = (k: string) => STATUS_LABELS[k] ? (en ? STATUS_LABELS[k].en : STATUS_LABELS[k].ar) : k;
  const t = {
    title: en ? "Driver Violations" : "مخالفات السائقين",
    subtitle: en ? "Track traffic violations and assign responsibility" : "تتبع المخالفات المرورية وتحديد المسؤولية",
    newViolation: en ? "New violation" : "مخالفة جديدة",
    totalViolations: en ? "Total violations" : "إجمالي المخالفات",
    pending: en ? "Pending" : "قيد التسوية",
    dueFromDrivers: en ? "Total due from drivers" : "إجمالي مستحق من السواقين",
    allDrivers: en ? "All drivers" : "كل السواقين",
    allStatuses: en ? "All statuses" : "كل الحالات",
    loading: en ? "Loading..." : "جاري التحميل...",
    noViolations: en ? "No violations" : "لا توجد مخالفات",
    colDateTime: en ? "Date & time" : "التاريخ والوقت",
    colDriver: en ? "Driver" : "السائق",
    colVehicle: en ? "Vehicle" : "السيارة",
    colType: en ? "Violation type" : "نوع المخالفة",
    colLocation: en ? "Location" : "المكان",
    colAmount: en ? "Amount" : "المبلغ",
    colResponsibility: en ? "Responsibility" : "المسؤولية",
    colPayment: en ? "Payment method" : "طريقة السداد",
    colStatus: en ? "Status" : "الحالة",
    driverShare: en ? "Driver:" : "سائق:",
    installments: (m: number | null) => en ? `Installments ${m} mo.` : `أقساط ${m} شهر`,
    remaining: (n: number) => en ? `${n} installment(s) left` : `متبقي ${n} قسط`,
    oneTime: en ? "One-time" : "دفعة واحدة",
    settle: en ? "Settle" : "تسوية",
    cancel: en ? "Cancel" : "إلغاء",
    deleteTitle: en ? "Delete violation" : "حذف المخالفة",
    chooseDriver: en ? "Select driver" : "اختر السائق",
    enterType: en ? "Please enter the violation type" : "يرجى إدخال نوع المخالفة",
    enterAmount: en ? "Please enter the violation amount" : "يرجى إدخال مبلغ المخالفة",
    chooseCategory: en ? "Please select the expense category for the company portion" : "يرجى اختيار فئة المصروف للجزء المحمّل على الشركة",
    errorOccurred: en ? "An error occurred" : "حدث خطأ",
    modalTitle: en ? "Register a new violation" : "تسجيل مخالفة جديدة",
    vehicle: en ? "Vehicle" : "السيارة",
    noVehicle: en ? "— No vehicle —" : "— بدون سيارة —",
    autoVehicleHint: en ? "✓ Driver's vehicle on this date — change it manually if they were on another vehicle" : "✓ سيارة السائق في هذا التاريخ — غيّرها يدوياً لو كان راكب سيارة أخرى",
    dateTimeLabel: en ? "Violation date & time" : "تاريخ ووقت المخالفة",
    locationLabel: en ? "Location" : "الموقع",
    locationPh: en ? "e.g. Gulf St., Hawally" : "مثال: شارع الخليج، حولي",
    typeLabel: en ? "Violation type" : "نوع المخالفة",
    typePh: en ? "e.g. Speeding, red light, illegal parking..." : "مثال: تجاوز سرعة، تخطي إشارة حمراء، وقوف مخالف...",
    descLabel: en ? "Detailed description" : "وصف تفصيلي",
    descPh: en ? "Additional details about the violation..." : "تفاصيل إضافية عن المخالفة...",
    amountLabel: en ? "Amount (KWD)" : "المبلغ (د.ك)",
    whoPays: en ? "Who bears the violation?" : "من يتحمل المخالفة؟",
    driverFull: en ? "Driver in full" : "السائق بالكامل",
    companyFull: en ? "Company in full" : "الشركة بالكامل",
    splitOpt: en ? "Split between driver and company" : "مقسّمة بين السائق والشركة",
    driverPct: en ? "Driver share %" : "نسبة السائق %",
    driverColon: en ? "Driver:" : "السائق:",
    companyColon: en ? "Company:" : "الشركة:",
    companyCat: en ? "Company expense category" : "فئة مصروف الشركة",
    chooseCat: en ? "Select category" : "اختر الفئة",
    catHint: en ? "The company-borne portion will be posted automatically as an expense." : "سيتم ترحيل الجزء المحمّل على الشركة تلقائياً كمصروف.",
    deductMethod: en ? "Driver deduction method" : "طريقة خصم السائق",
    fullFromSalary: en ? "One-time from salary" : "دفعة واحدة من الراتب",
    installmentFromSalary: en ? "Monthly installments from salary" : "أقساط شهرية من الراتب",
    months: en ? "Number of months" : "عدد الأشهر",
    monthlyInstallment: en ? "Monthly installment:" : "قسط شهري:",
    notes: en ? "Notes" : "ملاحظات",
    saving: en ? "Saving..." : "جاري الحفظ...",
    saveViolation: en ? "Save violation" : "حفظ المخالفة",
    confirmSettle: en ? "Confirm settling the violation?" : "تأكيد تسوية المخالفة؟",
    confirmCancel: en ? "Confirm cancelling the violation?" : "تأكيد إلغاء المخالفة؟",
    confirmDelete: en ? "Confirm deleting the violation?" : "تأكيد حذف المخالفة؟",
    settleDesc: en ? "Status will change to settled and it won't appear in future deductions." : "سيتم تغيير الحالة إلى مسوّاة ولن تظهر في الخصومات المستقبلية.",
    cancelDesc: en ? "The violation will be cancelled and won't be counted in salaries." : "سيتم إلغاء المخالفة ولن تُحتسب في الرواتب.",
    deleteDesc: en ? "The violation will be permanently deleted. If part of it is on the company, its expense will also be voided." : "سيتم حذف المخالفة نهائياً. إن كان جزء منها محمّلاً على الشركة سيُلغى مصروفه أيضاً.",
    back: en ? "Back" : "تراجع",
    inProgress: en ? "Working..." : "جاري...",
    settleBtn: en ? "Settle" : "تسوية",
    cancelBtn: en ? "Cancel violation" : "إلغاء المخالفة",
    deleteBtn: en ? "Delete violation" : "حذف المخالفة",
  };

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
  const [actionType, setActionType] = useState<"settle" | "cancel" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // السيارة المقترحة تلقائياً للسائق في تاريخ المخالفة (من سجل تبديل السيارات)
  const [vehicleAutoFilled, setVehicleAutoFilled] = useState(false);

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

  // عند اختيار السائق أو تغيير التاريخ، نحدّد سيارته المخصّصة في ذلك الوقت تلقائياً.
  // يمكن للمستخدم تغييرها يدوياً (مثلاً لو كان راكب سيارة بديلة في ذلك التاريخ).
  useEffect(() => {
    if (!form.driverId || !form.date) { setVehicleAutoFilled(false); return; }
    let cancelled = false;
    const params = new URLSearchParams({ date: new Date(form.date).toISOString() });
    fetch(`/api/delivery/drivers/${form.driverId}/vehicle-at?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.id) {
          setForm((p) => ({ ...p, vehicleId: res.data.id }));
          setVehicleAutoFilled(true);
        } else {
          setVehicleAutoFilled(false);
        }
      })
      .catch(() => { if (!cancelled) setVehicleAutoFilled(false); });
    return () => { cancelled = true; };
  }, [form.driverId, form.date]);

  async function save() {
    if (!form.driverId) { setFormError(t.chooseDriver); return; }
    if (!form.type.trim()) { setFormError(t.enterType); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError(t.enterAmount); return; }
    if (form.responsibility !== "DRIVER" && !form.expenseCategoryId) {
      setFormError(t.chooseCategory); return;
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

  function closeAction() {
    setActionId(null);
    setActionType(null);
    setActionError("");
  }

  async function doAction() {
    if (!actionId || !actionType) return;
    setActionLoading(true);
    setActionError("");

    let res: Response;
    if (actionType === "delete") {
      res = await fetch(`/api/delivery/violations/${actionId}`, { method: "DELETE" });
    } else {
      res = await fetch(`/api/delivery/violations/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: actionType === "settle" ? "SETTLED" : "CANCELLED" }),
      });
    }

    const data = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && data.success !== false) {
      closeAction();
      load();
    } else {
      setActionError(data.error ?? t.errorOccurred);
    }
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
        title={t.title}
        subtitle={t.subtitle}
        companyId={companyId}
        actions={
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(""); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus size={16} />
            {t.newViolation}
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.totalViolations}</p>
            <p className="mt-1 text-2xl font-bold">{violations.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.pending}</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{pending}</p>
          </div>
          <div className="stat-card col-span-2">
            <p className="text-xs text-muted-foreground">{t.dueFromDrivers}</p>
            <p className="mt-1 text-xl font-bold text-red-600">{fmt(totalPending)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={filterDriverId} onChange={(e) => setFilterDriverId(e.target.value)} className="input-field">
            <option value="">{t.allDrivers}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.employee.nameAr}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field">
            <option value="">{t.allStatuses}</option>
            {Object.keys(STATUS_LABELS).map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t.loading}</div>
          ) : violations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle size={40} className="mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{t.noViolations}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{t.colDateTime}</th>
                    <th>{t.colDriver}</th>
                    <th>{t.colVehicle}</th>
                    <th>{t.colType}</th>
                    <th>{t.colLocation}</th>
                    <th>{t.colAmount}</th>
                    <th>{t.colResponsibility}</th>
                    <th>{t.colPayment}</th>
                    <th>{t.colStatus}</th>
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
                          {new Date(v.date).toLocaleString(numberLocale, { dateStyle: "short", timeStyle: "short" })}
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
                            <p className="font-bold number">{fmt(Number(v.amount))}</p>
                            {driverAmount > 0 && driverAmount !== Number(v.amount) && (
                              <p className="text-xs text-red-600 number">{t.driverShare} {fmt(driverAmount)}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESP_COLORS[v.responsibility]}`}>
                            {respLabel(v.responsibility)}
                            {v.responsibility === "SPLIT" && v.driverSharePct && ` (${v.driverSharePct}%)`}
                          </span>
                        </td>
                        <td className="text-sm">
                          {v.paymentMode === "INSTALLMENT" ? (
                            <div>
                              <span className="text-xs">{t.installments(v.installmentMonths)}</span>
                              {v.status === "PENDING" && (
                                <p className="text-xs text-yellow-600">{t.remaining(remaining)}</p>
                              )}
                            </div>
                          ) : t.oneTime}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[v.status]}`}>
                            {statusLabel(v.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {v.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => { setActionId(v.id); setActionType("settle"); setActionError(""); }}
                                  className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                                >
                                  {t.settle}
                                </button>
                                <button
                                  onClick={() => { setActionId(v.id); setActionType("cancel"); setActionError(""); }}
                                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                                >
                                  {t.cancel}
                                </button>
                              </>
                            )}
                            {v.status !== "SETTLED" && (
                              <button
                                onClick={() => { setActionId(v.id); setActionType("delete"); setActionError(""); }}
                                title={t.deleteTitle}
                                className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
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
              <h2 className="font-semibold">{t.modalTitle}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              {/* Driver & vehicle */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">{t.colDriver} <span className="text-red-500">*</span></label>
                  <select value={form.driverId} onChange={f("driverId")} className="input-field w-full">
                    <option value="">{t.chooseDriver}</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.employee.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{t.vehicle}</label>
                  <select
                    value={form.vehicleId}
                    onChange={(e) => { setVehicleAutoFilled(false); f("vehicleId")(e); }}
                    className="input-field w-full"
                  >
                    <option value="">{t.noVehicle}</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber}{v.make ? ` — ${v.make}` : ""}
                      </option>
                    ))}
                  </select>
                  {vehicleAutoFilled && form.vehicleId && (
                    <p className="mt-1 text-xs text-emerald-600">
                      {t.autoVehicleHint}
                    </p>
                  )}
                </div>
              </div>

              {/* Date & location */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">{t.dateTimeLabel} <span className="text-red-500">*</span></label>
                  <input type="datetime-local" value={form.date} onChange={f("date")} className="input-field w-full" dir="ltr" />
                </div>
                <div>
                  <label className="form-label">{t.locationLabel}</label>
                  <input type="text" value={form.locationAr} onChange={f("locationAr")} className="input-field w-full" placeholder={t.locationPh} />
                </div>
              </div>

              {/* Type & description */}
              <div>
                <label className="form-label">{t.typeLabel} <span className="text-red-500">*</span></label>
                <input type="text" value={form.type} onChange={f("type")} className="input-field w-full"
                  placeholder={t.typePh} />
              </div>
              <div>
                <label className="form-label">{t.descLabel}</label>
                <textarea rows={2} value={form.descriptionAr} onChange={f("descriptionAr")} className="input-field w-full resize-none"
                  placeholder={t.descPh} />
              </div>

              {/* Amount & responsibility */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">{t.amountLabel} <span className="text-red-500">*</span></label>
                  <input type="number" step="0.001" min="0" value={form.amount} onChange={f("amount")} className="input-field w-full" dir="ltr" placeholder="0.000" />
                </div>
                <div>
                  <label className="form-label">{t.whoPays} <span className="text-red-500">*</span></label>
                  <select value={form.responsibility} onChange={f("responsibility")} className="input-field w-full">
                    <option value="DRIVER">{t.driverFull}</option>
                    <option value="COMPANY">{t.companyFull}</option>
                    <option value="SPLIT">{t.splitOpt}</option>
                  </select>
                </div>
              </div>

              {/* Split percentage */}
              {form.responsibility === "SPLIT" && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <label className="form-label">{t.driverPct}</label>
                  <input type="number" min="1" max="99" value={form.driverSharePct} onChange={f("driverSharePct")} className="input-field w-32" dir="ltr" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.driverColon} {form.amount ? (Number(form.amount) * Number(form.driverSharePct) / 100).toFixed(3) : "0.000"} {kwd}
                    &nbsp;|&nbsp;
                    {t.companyColon} {form.amount ? (Number(form.amount) * (100 - Number(form.driverSharePct)) / 100).toFixed(3) : "0.000"} {kwd}
                  </p>
                </div>
              )}

              {/* Company expense category */}
              {(form.responsibility === "COMPANY" || form.responsibility === "SPLIT") && (
                <div>
                  <label className="form-label">{t.companyCat} <span className="text-red-500">*</span></label>
                  <select value={form.expenseCategoryId} onChange={f("expenseCategoryId")} className="input-field w-full">
                    <option value="">{t.chooseCat}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">{t.catHint}</p>
                </div>
              )}

              {/* Driver deduction method */}
              {form.responsibility !== "COMPANY" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">{t.deductMethod}</label>
                    <select value={form.paymentMode} onChange={f("paymentMode")} className="input-field w-full">
                      <option value="FULL">{t.fullFromSalary}</option>
                      <option value="INSTALLMENT">{t.installmentFromSalary}</option>
                    </select>
                  </div>
                  {form.paymentMode === "INSTALLMENT" && (
                    <div>
                      <label className="form-label">{t.months}</label>
                      <input type="number" min="1" max="12" value={form.installmentMonths} onChange={f("installmentMonths")} className="input-field w-full" dir="ltr" />
                      {form.amount && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.monthlyInstallment}{" "}
                          {(
                            (Number(form.amount) * (form.responsibility === "SPLIT" ? Number(form.driverSharePct) / 100 : 1))
                            / Number(form.installmentMonths)
                          ).toFixed(3)} {kwd}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="form-label">{t.notes}</label>
                <textarea rows={2} value={form.notes} onChange={f("notes")} className="input-field w-full resize-none" />
              </div>

              {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
                <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {saving ? t.saving : t.saveViolation}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settle / Cancel / Delete confirm */}
      {actionId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-2xl">
            <p className="font-medium">
              {actionType === "settle" ? t.confirmSettle
                : actionType === "cancel" ? t.confirmCancel
                : t.confirmDelete}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {actionType === "settle"
                ? t.settleDesc
                : actionType === "cancel"
                  ? t.cancelDesc
                  : t.deleteDesc}
            </p>
            {actionError && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeAction} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.back}</button>
              <button
                onClick={doAction}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${actionType === "settle" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {actionLoading ? t.inProgress
                  : actionType === "settle" ? t.settleBtn
                  : actionType === "cancel" ? t.cancelBtn
                  : t.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
