"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Save, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Employee {
  id: string;
  nameAr: string;
  type: string;
  baseSalary: number | null;
}

interface PaymentLine {
  employeeId: string;
  baseAmount: string;
  incentives: string;
  deductions: string;
  additionalEarnings: string;
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

export default function NewSalaryBatchPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/hr/employees?companyId=${companyId}&active=true`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) {
          const items: Employee[] = payload.data;
          setEmployees(items);
          setLines(
            items.map((employee) => ({
              employeeId: employee.id,
              baseAmount: employee.baseSalary != null ? String(employee.baseSalary) : "",
              incentives: "0",
              deductions: "0",
              additionalEarnings: "0",
              notes: "",
            })),
          );
        }
      })
      .catch(() => {
        setError(locale === "en" ? "Failed to load employees" : "تعذر تحميل الموظفين");
      })
      .finally(() => setLoadingEmployees(false));
  }, [companyId, locale]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-KW", {
          month: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2026, index, 1))),
      })),
    [locale],
  );

  function updateLine(index: number, field: keyof PaymentLine, value: string) {
    setLines((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function calcNet(line: PaymentLine) {
    const base = parseFloat(line.baseAmount) || 0;
    const incentives = parseFloat(line.incentives) || 0;
    const deductions = parseFloat(line.deductions) || 0;
    const additionalEarnings = parseFloat(line.additionalEarnings) || 0;
    return base + incentives + additionalEarnings - deductions;
  }

  const totalGross = lines.reduce(
    (sum, line) => sum + (parseFloat(line.baseAmount) || 0) + (parseFloat(line.incentives) || 0) + (parseFloat(line.additionalEarnings) || 0),
    0,
  );
  const totalNet = lines.reduce((sum, line) => sum + calcNet(line), 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const activeLines = lines.filter((line) => parseFloat(line.baseAmount) > 0);
    if (activeLines.length === 0) {
      setError(locale === "en" ? "At least one employee salary is required" : "يجب إدخال راتب لموظف واحد على الأقل");
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
            baseAmount: parseFloat(line.baseAmount) || 0,
            incentives: parseFloat(line.incentives) || 0,
            deductions: parseFloat(line.deductions) || 0,
            additionalEarnings: parseFloat(line.additionalEarnings) || 0,
            notes: line.notes || undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to save batch" : "فشل في حفظ الدفعة"));
      }

      router.push(`/dashboard/companies/${companyId}/hr/salaries`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New Salary Batch" : "دفعة رواتب جديدة"}
        subtitle={locale === "en" ? "Create a monthly salary cycle" : "إنشاء دورة رواتب شهرية"}
        companyId={companyId}
      />

      <div className="page-container max-w-6xl">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {locale === "en" ? "Back to salaries" : "العودة للرواتب"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Batch information" : "بيانات الدفعة"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Month" : "الشهر"} <span className="text-red-500">*</span>
                </label>
                <select value={month} onChange={(event) => setMonth(parseInt(event.target.value, 10))} className="input-field w-full">
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Year" : "السنة"} <span className="text-red-500">*</span>
                </label>
                <select value={year} onChange={(event) => setYear(parseInt(event.target.value, 10))} className="input-field w-full">
                  {[2024, 2025, 2026, 2027].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Optional notes" : "ملاحظات اختيارية"}
                />
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="mb-4 flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Employee salaries" : "رواتب الموظفين"}
              </h3>
            </div>

            {loadingEmployees ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {locale === "en" ? "Loading employees..." : "جاري تحميل الموظفين..."}
              </div>
            ) : employees.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {locale === "en" ? "No active employees found for this company" : "لا يوجد موظفون نشطون في هذه الشركة"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Employee" : "الموظف"}</th>
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Type" : "النوع"}</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Base salary" : "الراتب الأساسي"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Incentives" : "الحوافز"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Additions" : "الإضافات"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Deductions" : "الخصومات"}</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Net" : "الصافي"}</th>
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Notes" : "ملاحظات"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee, index) => {
                      const line = lines[index];
                      if (!line) return null;
                      const net = calcNet(line);
                      const typeLabel = employeeTypeLabels[employee.type]?.[locale] ?? employee.type;

                      return (
                        <tr key={employee.id} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{employee.nameAr}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{typeLabel}</td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.001" min="0" value={line.baseAmount} onChange={(event) => updateLine(index, "baseAmount", event.target.value)} className="input-field w-full text-left" dir="ltr" placeholder="0.000" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.001" min="0" value={line.incentives} onChange={(event) => updateLine(index, "incentives", event.target.value)} className="input-field w-full text-left text-green-600" dir="ltr" placeholder="0.000" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.001" min="0" value={line.additionalEarnings} onChange={(event) => updateLine(index, "additionalEarnings", event.target.value)} className="input-field w-full text-left text-blue-600" dir="ltr" placeholder="0.000" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.001" min="0" value={line.deductions} onChange={(event) => updateLine(index, "deductions", event.target.value)} className="input-field w-full text-left text-red-600" dir="ltr" placeholder="0.000" />
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-bold number ${net > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{net.toFixed(3)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={line.notes}
                              onChange={(event) => updateLine(index, "notes", event.target.value)}
                              className="input-field w-full"
                              placeholder={locale === "en" ? "Optional note" : "ملاحظة اختيارية"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/30 font-bold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                      <td className="px-3 py-2 text-left number">{totalGross.toFixed(3)}</td>
                      <td></td>
                      <td></td>
                      <td className="px-3 py-2 text-left number text-emerald-600">{totalNet.toFixed(3)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || loadingEmployees}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save batch" : "حفظ الدفعة"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/hr/salaries`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
