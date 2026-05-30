"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Save, Truck, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

// معدّل الحافز/الخصم لكل طلب فوق/تحت التارجيت (نصف دينار) — ثابت للجميع
const INCENTIVE_RATE = 0.5;
const DEFAULT_FOOD_ALLOWANCE = "15";

// أنواع سائقي التوصيل الذين يخضعون لحساب التارجيت. الموظفون المسجّلون كسائقين
// لكن نوعهم إداري/مكتب (مثل DELIVERY_ADMIN أو OFFICE_EMPLOYEE) يظهرون في قسم
// الموظفين الآخرين بدون تارجيت.
const DELIVERY_DRIVER_TYPES = ["DRIVER", "DELIVERY_DRIVER"];

interface DriverInfo {
  id: string;
  targetOrders: number;
}

interface Employee {
  id: string;
  nameAr: string;
  type: string;
  baseSalary: number | null;
  driver: DriverInfo | null;
}

// سطر راتب — يحمل التفصيل الكامل للسائقين والحقول البسيطة لباقي الموظفين
interface PaymentLine {
  employeeId: string;
  isDriver: boolean;
  driverId: string | null;
  baseAmount: string;
  // تفصيل السائقين
  targetOrders: string;
  actualOrders: string;
  incentive: string;        // حافز (تلقائي عند تجاوز التارجيت، قابل للتعديل)
  foodAllowance: string;    // بدل طعام (افتراضي 15)
  companyAddition: string;  // إضافة شركة
  fuelAddition: string;     // إضافة بنزين وبنشر
  targetDeduction: string;  // خصم تارجيت (تلقائي عند أقل من التارجيت)
  companyDeduction: string; // خصم شركة
  // الموظفون الآخرون (الشكل البسيط)
  additionalEarnings: string;
  deductions: string;
  notes: string;
}

const employeeTypeLabels: Record<string, { ar: string; en: string }> = {
  DRIVER: { ar: "سائق", en: "Driver" },
  DELIVERY_DRIVER: { ar: "سائق توصيل", en: "Delivery Driver" },
  DELIVERY_ADMIN: { ar: "إداري توصيل", en: "Delivery Admin" },
  CAR_WASH_DRIVER: { ar: "سائق غسيل", en: "Car Wash Driver" },
  CAR_WASH_WORKER: { ar: "عامل غسيل", en: "Car Wash Worker" },
  OFFICE_EMPLOYEE: { ar: "موظف مكتب", en: "Office Employee" },
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  MANDOUB: { ar: "مندوب", en: "Mandoub" },
  OFFICE_BOY: { ar: "عامل خدمات", en: "Office Boy" },
  OTHER: { ar: "أخرى", en: "Other" },
};

function n(value: string) {
  return parseFloat(value) || 0;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export default function NewSalaryBatchPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;
  const ar = locale !== "en";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");

  // تحميل الموظفين مرة واحدة
  useEffect(() => {
    fetch(`/api/hr/employees?companyId=${companyId}&active=true`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          const items: Employee[] = payload.data;
          setEmployees(items);
          setLines(
            items.map((employee) => {
              const driver = employee.driver;
              // يُعامل كسائق توصيل (له تارجيت) فقط إذا كان نوعه سائق توصيل وله سجل سائق
              const isDriver = !!driver && DELIVERY_DRIVER_TYPES.includes(employee.type);
              return {
                employeeId: employee.id,
                isDriver,
                driverId: driver?.id ?? null,
                baseAmount: employee.baseSalary != null ? String(employee.baseSalary) : "",
                targetOrders: isDriver ? String(driver?.targetOrders ?? 370) : "",
                actualOrders: "",
                incentive: "0",
                foodAllowance: isDriver ? DEFAULT_FOOD_ALLOWANCE : "0",
                companyAddition: "0",
                fuelAddition: "0",
                targetDeduction: "0",
                companyDeduction: "0",
                additionalEarnings: "0",
                deductions: "0",
                notes: "",
              };
            }),
          );
        }
      })
      .catch(() => setError(ar ? "تعذر تحميل الموظفين" : "Failed to load employees"))
      .finally(() => setLoadingEmployees(false));
  }, [companyId, ar]);

  // عند تغيير الشهر/السنة، نجلب الطلبات المحسوبة لكل سائق ونعيد حساب الحافز/الخصم
  useEffect(() => {
    if (employees.length === 0) return;
    setLoadingOrders(true);
    fetch(`/api/delivery/driver-orders?companyId=${companyId}&month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((res) => {
        const totals: Record<string, number> = res.success ? res.data : {};
        setLines((prev) =>
          prev.map((line) => {
            if (!line.isDriver || !line.driverId) return line;
            const actual = totals[line.driverId] ?? 0;
            const target = parseInt(line.targetOrders || "0", 10) || 0;
            const diff = actual - target;
            return {
              ...line,
              actualOrders: String(actual),
              incentive: diff > 0 ? String(round3(diff * INCENTIVE_RATE)) : "0",
              targetDeduction: diff < 0 ? String(round3(-diff * INCENTIVE_RATE)) : "0",
            };
          }),
        );
      })
      .finally(() => setLoadingOrders(false));
  }, [companyId, month, year, employees.length]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat(ar ? "ar-KW" : "en-US", { month: "long", timeZone: "UTC" }).format(
          new Date(Date.UTC(2026, index, 1)),
        ),
      })),
    [ar],
  );

  function setLineField(employeeId: string, field: keyof PaymentLine, value: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.employeeId !== employeeId) return line;
        const next = { ...line, [field]: value };
        // إعادة حساب الحافز/خصم التارجيت تلقائياً عند تغيير الطلبات أو التارجيت
        if (line.isDriver && (field === "actualOrders" || field === "targetOrders")) {
          const actual = parseInt(field === "actualOrders" ? value : next.actualOrders || "0", 10) || 0;
          const target = parseInt(field === "targetOrders" ? value : next.targetOrders || "0", 10) || 0;
          const diff = actual - target;
          next.incentive = diff > 0 ? String(round3(diff * INCENTIVE_RATE)) : "0";
          next.targetDeduction = diff < 0 ? String(round3(-diff * INCENTIVE_RATE)) : "0";
        }
        return next;
      }),
    );
  }

  function driverNet(line: PaymentLine) {
    return round3(
      n(line.baseAmount) + n(line.incentive) + n(line.foodAllowance) + n(line.companyAddition) +
      n(line.fuelAddition) - n(line.targetDeduction) - n(line.companyDeduction),
    );
  }

  function otherNet(line: PaymentLine) {
    return round3(n(line.baseAmount) + n(line.incentive) + n(line.additionalEarnings) - n(line.deductions));
  }

  function lineNet(line: PaymentLine) {
    return line.isDriver ? driverNet(line) : otherNet(line);
  }

  const driverLines = lines.filter((l) => l.isDriver);
  const otherLines = lines.filter((l) => !l.isDriver);
  const totalNet = lines.reduce((sum, line) => sum + lineNet(line), 0);

  function employeeFor(employeeId: string) {
    return employees.find((e) => e.id === employeeId);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const activeLines = lines.filter((line) => n(line.baseAmount) > 0 || lineNet(line) !== 0);
    if (activeLines.length === 0) {
      setError(ar ? "يجب إدخال راتب لموظف واحد على الأقل" : "At least one employee salary is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/hr/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          month,
          year,
          notes: notes || undefined,
          payments: activeLines.map((line) => ({
            employeeId: line.employeeId,
            baseAmount: n(line.baseAmount),
            incentives: n(line.incentive),
            ...(line.isDriver
              ? {
                  targetOrders: parseInt(line.targetOrders || "0", 10) || undefined,
                  actualOrders: parseInt(line.actualOrders || "0", 10) || undefined,
                  foodAllowance: n(line.foodAllowance),
                  companyAddition: n(line.companyAddition),
                  fuelAddition: n(line.fuelAddition),
                  targetDeduction: n(line.targetDeduction),
                  companyDeduction: n(line.companyDeduction),
                }
              : {
                  additionalEarnings: n(line.additionalEarnings),
                  deductions: n(line.deductions),
                }),
            notes: line.notes || undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (ar ? "فشل في حفظ الدفعة" : "Failed to save batch"));

      router.push(`/dashboard/companies/${companyId}/hr/salaries`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : ar ? "حدث خطأ غير متوقع" : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  const numInput =
    "input-field w-full text-left tabular-nums";

  return (
    <div>
      <Header
        title={ar ? "دفعة رواتب جديدة" : "New Salary Batch"}
        subtitle={ar ? "إنشاء دورة رواتب شهرية" : "Create a monthly salary cycle"}
        companyId={companyId}
      />

      <div className="page-container max-w-[1400px]">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {ar ? "العودة للرواتب" : "Back to salaries"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {ar ? "بيانات الدفعة" : "Batch information"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {ar ? "الشهر" : "Month"} <span className="text-red-500">*</span>
                </label>
                <select value={month} onChange={(event) => setMonth(parseInt(event.target.value, 10))} className="input-field w-full">
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {ar ? "السنة" : "Year"} <span className="text-red-500">*</span>
                </label>
                <select value={year} onChange={(event) => setYear(parseInt(event.target.value, 10))} className="input-field w-full">
                  {[2024, 2025, 2026, 2027].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{ar ? "ملاحظات" : "Notes"}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input-field w-full"
                  placeholder={ar ? "ملاحظات اختيارية" : "Optional notes"}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {loadingOrders
                ? (ar ? "جارٍ جلب الطلبات المحسوبة لهذا الشهر..." : "Loading computed orders for this month...")
                : (ar
                    ? `يُحسب الحافز/خصم التارجيت تلقائياً: ${INCENTIVE_RATE} د.ك لكل طلب فوق/تحت تارجيت السائق، حسب تقرير الطلبات المرحّل لهذا الشهر. كل القيم قابلة للتعديل.`
                    : `Incentive/target deduction is auto-computed: ${INCENTIVE_RATE} KWD per order above/below target. All values are editable.`)}
            </p>
          </div>

          {loadingEmployees ? (
            <div className="section-card py-8 text-center text-sm text-muted-foreground">
              {ar ? "جاري تحميل الموظفين..." : "Loading employees..."}
            </div>
          ) : (
            <>
              {/* ── سائقو التوصيل ── */}
              {driverLines.length > 0 && (
                <div className="section-card">
                  <div className="mb-4 flex items-center gap-2">
                    <Truck size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      {ar ? "سائقو التوصيل" : "Delivery drivers"}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-xs">
                          <th className="px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "السائق" : "Driver"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "أساسي" : "Base"}</th>
                          <th className="w-20 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "تارجيت" : "Target"}</th>
                          <th className="w-20 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "الطلبات" : "Orders"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-green-700">{ar ? "حافز" : "Incentive"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? "بدل طعام" : "Food"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? "إضافة شركة" : "Company add"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? "بنزين وبنشر" : "Fuel/tire"}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-red-700">{ar ? "خصم تارجيت" : "Target ded."}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-red-700">{ar ? "خصم شركة" : "Company ded."}</th>
                          <th className="w-24 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "الصافي" : "Net"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverLines.map((line) => {
                          const emp = employeeFor(line.employeeId);
                          if (!emp) return null;
                          return (
                            <tr key={line.employeeId} className="border-b border-border">
                              <td className="px-2 py-2 font-medium">{emp.nameAr}</td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.baseAmount} onChange={(e) => setLineField(line.employeeId, "baseAmount", e.target.value)} className={numInput} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="1" min="0" value={line.targetOrders} onChange={(e) => setLineField(line.employeeId, "targetOrders", e.target.value)} className={numInput} dir="ltr" placeholder="370" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="1" min="0" value={line.actualOrders} onChange={(e) => setLineField(line.employeeId, "actualOrders", e.target.value)} className={numInput} dir="ltr" placeholder="0" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.incentive} onChange={(e) => setLineField(line.employeeId, "incentive", e.target.value)} className={`${numInput} text-green-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.foodAllowance} onChange={(e) => setLineField(line.employeeId, "foodAllowance", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.companyAddition} onChange={(e) => setLineField(line.employeeId, "companyAddition", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.fuelAddition} onChange={(e) => setLineField(line.employeeId, "fuelAddition", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.targetDeduction} onChange={(e) => setLineField(line.employeeId, "targetDeduction", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.001" min="0" value={line.companyDeduction} onChange={(e) => setLineField(line.employeeId, "companyDeduction", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-2 py-2 text-left">
                                <span className={`number font-bold ${driverNet(line) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{driverNet(line).toFixed(3)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ar
                      ? "الطلبات تظهر تلقائياً من تقرير الطلبات المرحّل (تحتسب للسائق البديل عند التوزيع). عدّل أي قيمة يدوياً عند الحاجة."
                      : "Orders are auto-filled from the posted orders report (counted for the substitute driver). Edit any value manually if needed."}
                  </p>
                </div>
              )}

              {/* ── باقي الموظفين (الشكل البسيط) ── */}
              {otherLines.length > 0 && (
                <div className="section-card">
                  <div className="mb-4 flex items-center gap-2">
                    <Users size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      {ar ? "موظفون آخرون" : "Other employees"}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-right font-bold text-muted-foreground">{ar ? "الموظف" : "Employee"}</th>
                          <th className="px-3 py-2 text-right font-bold text-muted-foreground">{ar ? "النوع" : "Type"}</th>
                          <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{ar ? "الراتب الأساسي" : "Base salary"}</th>
                          <th className="w-28 px-3 py-2 text-right font-bold text-green-700">{ar ? "الحوافز" : "Incentives"}</th>
                          <th className="w-28 px-3 py-2 text-right font-bold text-blue-700">{ar ? "الإضافات" : "Additions"}</th>
                          <th className="w-28 px-3 py-2 text-right font-bold text-red-700">{ar ? "الخصومات" : "Deductions"}</th>
                          <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{ar ? "الصافي" : "Net"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherLines.map((line) => {
                          const emp = employeeFor(line.employeeId);
                          if (!emp) return null;
                          const typeLabel = employeeTypeLabels[emp.type]?.[ar ? "ar" : "en"] ?? emp.type;
                          return (
                            <tr key={line.employeeId} className="border-b border-border">
                              <td className="px-3 py-2 font-medium">{emp.nameAr}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{typeLabel}</td>
                              <td className="px-3 py-2">
                                <input type="number" step="0.001" min="0" value={line.baseAmount} onChange={(e) => setLineField(line.employeeId, "baseAmount", e.target.value)} className={numInput} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" step="0.001" min="0" value={line.incentive} onChange={(e) => setLineField(line.employeeId, "incentive", e.target.value)} className={`${numInput} text-green-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" step="0.001" min="0" value={line.additionalEarnings} onChange={(e) => setLineField(line.employeeId, "additionalEarnings", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" step="0.001" min="0" value={line.deductions} onChange={(e) => setLineField(line.employeeId, "deductions", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" placeholder="0.000" />
                              </td>
                              <td className="px-3 py-2 text-left">
                                <span className={`number font-bold ${otherNet(line) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{otherNet(line).toFixed(3)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {employees.length === 0 && (
                <div className="section-card py-8 text-center text-sm text-muted-foreground">
                  {ar ? "لا يوجد موظفون نشطون في هذه الشركة" : "No active employees found for this company"}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || loadingEmployees}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ الدفعة" : "Save batch"}
              </button>
              <Link
                href={`/dashboard/companies/${companyId}/hr/salaries`}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {ar ? "إلغاء" : "Cancel"}
              </Link>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{ar ? "إجمالي الصافي:" : "Total net:"}</span>{" "}
              <span className="number text-lg font-bold text-emerald-600">{totalNet.toFixed(3)}</span>{" "}
              <span className="text-muted-foreground">{ar ? "د.ك" : "KWD"}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
