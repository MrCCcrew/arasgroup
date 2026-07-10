"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Calculator, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { formatDate, formatKWD } from "@/lib/utils";

interface Employee {
  id: string;
  nameAr: string;
  nameEn?: string;
  employeeNumber?: string;
  joinDate?: string;
  baseSalary?: number;
  type?: string;
}

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  bankName: string;
}

const ACTIONS = {
  ar: [
    { value: "CALCULATE", label: "حساب فقط بدون قيد" },
    { value: "ACCRUE", label: "تسجيل كمستحق" },
    { value: "PAY", label: "صرف فوري" },
  ],
  en: [
    { value: "CALCULATE", label: "Calculate only" },
    { value: "ACCRUE", label: "Accrue amount" },
    { value: "PAY", label: "Pay now" },
  ],
} as const;

export default function NewLeavePayPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    year: new Date().getFullYear(),
    periodStartDate: "",
    periodEndDate: "",
    leaveDaysUsed: "0",
    leaveDaysOwed: "",
    manualOverride: false,
    action: "CALCULATE",
    paymentMethod: "CASH",
    bankAccountId: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/hr/employees?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/accounting/bank-accounts?companyId=${companyId}`).then((response) => response.json()),
    ]).then(([employeePayload, bankPayload]) => {
      if (employeePayload.success) setEmployees(employeePayload.data);
      if (bankPayload.success) setBankAccounts(bankPayload.data);
    });
  }, [companyId]);

  const employee = employees.find((item) => item.id === form.employeeId);

  const preview = useMemo(() => {
    if (!employee?.joinDate || !employee.baseSalary) return null;

    const asOf = new Date(form.year, 11, 31);
    const serviceYears = (asOf.getTime() - new Date(employee.joinDate).getTime()) / (365 * 86400000);

    if (serviceYears < 1) {
      return {
        error: locale === "en" ? "Employee has not completed one full year yet" : "الموظف لم يكمل سنة عمل بعد",
      };
    }

    // Kuwaiti labor law: 30 days annual leave for all employees
    const annualDays = 30;

    // Calculate days owed based on period if dates provided
    let autoDaysOwed = annualDays;
    if (form.periodStartDate && form.periodEndDate) {
      const start = new Date(form.periodStartDate);
      const end = new Date(form.periodEndDate);
      const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      autoDaysOwed = Math.round((daysInPeriod / 365) * annualDays * 10) / 10; // Round to 1 decimal
    }

    const daysOwed = form.manualOverride && form.leaveDaysOwed ? Number.parseFloat(form.leaveDaysOwed) : autoDaysOwed;
    const daysUsed = Math.max(0, Number.parseFloat(form.leaveDaysUsed) || 0);
    const daysPaid = Math.max(0, daysOwed - daysUsed);
    const dailyWage = Number(employee.baseSalary) / 30;
    const total = daysPaid * dailyWage;

    return {
      daysOwed,
      daysUsed,
      daysPaid,
      dailyWage,
      total,
      autoDaysOwed,
      annualDays,
    };
  }, [employee?.baseSalary, employee?.joinDate, employee?.type, form.leaveDaysUsed, form.leaveDaysOwed, form.manualOverride, form.periodStartDate, form.periodEndDate, form.year, locale]);

  function setField(field: keyof typeof form, value: string | number) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!preview || "error" in preview) {
      setError(preview?.error || (locale === "en" ? "Please review the calculation" : "يرجى مراجعة الحساب"));
      return;
    }

    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/hr/leave-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          employeeId: form.employeeId,
          year: Number(form.year),
          periodStartDate: form.periodStartDate || null,
          periodEndDate: form.periodEndDate || null,
          leaveDaysUsed: Number.parseFloat(form.leaveDaysUsed) || 0,
          daysOwed: preview.daysOwed,
          daysPaid: preview.daysPaid,
          dailyWage: preview.dailyWage,
          totalAmount: preview.total,
          action: form.action,
          paymentMethod: form.action === "PAY" ? form.paymentMethod : null,
          bankAccountId: form.action === "PAY" && form.paymentMethod === "BANK" ? form.bankAccountId : null,
          notes: form.notes || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      }

      router.push(`/dashboard/companies/${companyId}/accounting/leave-pay`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 2 + index);
  const employeeName = employee ? (locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr) : "";

  return (
    <div>
      <Header
        title={locale === "en" ? "Leave Pay Calculation" : "حساب بدل الإجازة"}
        subtitle={locale === "en" ? "Leave pay calculation under Kuwait labor rules" : "احتساب بدل الإجازة وفق نظام العمل الكويتي"}
        companyId={companyId}
      />
      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/accounting/leave-pay`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to leave pay" : "العودة إلى بدل الإجازة"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Leave details" : "بيانات الإجازة"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Employee" : "الموظف"} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(event) => setField("employeeId", event.target.value)}
                  className="input-field w-full"
                >
                  <option value="">{locale === "en" ? "Select employee" : "اختر الموظف"}</option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(locale === "en" ? item.nameEn ?? item.nameAr : item.nameAr) +
                        (item.employeeNumber ? ` (${item.employeeNumber})` : "")}
                    </option>
                  ))}
                </select>
              </div>

              {employee && (
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <p className="mb-1 font-medium">{employeeName}</p>
                    <p>
                      <span className="text-muted-foreground">
                        {locale === "en" ? "Join date: " : "تاريخ الالتحاق: "}
                      </span>
                      <strong>
                        {employee.joinDate
                          ? formatDate(employee.joinDate, numberLocale)
                          : locale === "en"
                            ? "Not recorded"
                            : "غير مسجل"}
                      </strong>
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 text-sm">
                    <p>
                      <span className="text-muted-foreground">
                        {locale === "en" ? "Base salary: " : "الراتب الأساسي: "}
                      </span>
                      <strong className="number">
                        {employee.baseSalary
                          ? formatKWD(Number(employee.baseSalary), numberLocale)
                          : locale === "en"
                            ? "Not recorded"
                            : "غير مسجل"}
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Year" : "السنة"}
                </label>
                <select
                  value={form.year}
                  onChange={(event) => setField("year", Number.parseInt(event.target.value, 10))}
                  className="input-field w-full"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Period start date" : "تاريخ بداية الفترة"}
                </label>
                <input
                  type="date"
                  value={form.periodStartDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, periodStartDate: event.target.value, manualOverride: false }))
                  }
                  className="input-field w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "en"
                    ? "Leave blank to use full year (30 days)"
                    : "اتركه فارغاً لحساب السنة كاملة (30 يوم)"}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Period end date" : "تاريخ نهاية الفترة"}
                </label>
                <input
                  type="date"
                  value={form.periodEndDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, periodEndDate: event.target.value, manualOverride: false }))
                  }
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Leave days owed" : "أيام الإجازة المستحقة"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  step="0.5"
                  value={form.leaveDaysOwed}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, leaveDaysOwed: event.target.value, manualOverride: true }))
                  }
                  className="input-field w-full"
                  placeholder={preview?.autoDaysOwed ? String(preview.autoDaysOwed) : ""}
                  dir="ltr"
                />
                {preview?.autoDaysOwed && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locale === "en" ? "Auto-calculated:" : "محسوبة تلقائياً:"} {preview.autoDaysOwed}{" "}
                    {locale === "en" ? "days" : "يوم"}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Leave days already used" : "أيام الإجازة المستخدمة"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.leaveDaysUsed}
                  onChange={(event) => setField("leaveDaysUsed", event.target.value)}
                  className="input-field w-full"
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {preview && !("error" in preview) && (
            <div className="section-card space-y-3 border-2 border-blue-200 bg-blue-50/50">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Calculator size={16} />
                {locale === "en" ? "Calculation preview" : "نتيجة الحساب"}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <PreviewBox label={locale === "en" ? "Days owed" : "الأيام المستحقة"} value={`${preview.daysOwed}`} />
                <PreviewBox label={locale === "en" ? "Days used" : "الأيام المستخدمة"} value={`${preview.daysUsed}`} />
                <PreviewBox label={locale === "en" ? "Days paid" : "أيام الصرف"} value={`${preview.daysPaid}`} />
                <PreviewBox
                  label={locale === "en" ? "Daily wage" : "الأجر اليومي"}
                  value={formatKWD(preview.dailyWage, numberLocale)}
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">
                  {locale === "en" ? "Leave pay total:" : "إجمالي بدل الإجازة:"}
                </span>
                <span className="number text-2xl font-bold text-blue-600">
                  {formatKWD(preview.total, numberLocale)}
                </span>
              </div>
            </div>
          )}

          {preview && "error" in preview && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {preview.error}
            </div>
          )}

          <div className="section-card space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Accounting action" : "الإجراء المحاسبي"}
            </h3>
            {ACTIONS[locale].map((action) => (
              <label
                key={action.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  form.action === action.value ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="action"
                  value={action.value}
                  checked={form.action === action.value}
                  onChange={(event) => setField("action", event.target.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{action.label}</span>
              </label>
            ))}

            {form.action === "PAY" && (
              <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    {locale === "en" ? "Payment method" : "طريقة الصرف"}
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => setField("paymentMethod", event.target.value)}
                    className="input-field w-full"
                  >
                    <option value="CASH">{locale === "en" ? "Cash" : "نقدي"}</option>
                    <option value="BANK">{locale === "en" ? "Bank transfer" : "تحويل بنكي"}</option>
                  </select>
                </div>
                {form.paymentMethod === "BANK" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {locale === "en" ? "Bank account" : "الحساب البنكي"}
                    </label>
                    <select
                      value={form.bankAccountId}
                      onChange={(event) => setField("bankAccountId", event.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">{locale === "en" ? "Select bank" : "اختر الحساب"}</option>
                      {bankAccounts.map((bankAccount) => (
                        <option key={bankAccount.id} value={bankAccount.id}>
                          {locale === "en" ? bankAccount.nameEn ?? bankAccount.nameAr : bankAccount.nameAr}
                          {" - "}
                          {bankAccount.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Notes" : "ملاحظات"}
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !form.employeeId || !preview || ("error" in preview)}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {form.action === "CALCULATE" ? <Calculator size={16} /> : <Save size={16} />}
              {saving
                ? locale === "en"
                  ? "Saving..."
                  : "جارٍ الحفظ..."
                : form.action === "CALCULATE"
                  ? locale === "en"
                    ? "Save calculation"
                    : "حفظ الحساب"
                  : form.action === "ACCRUE"
                    ? locale === "en"
                      ? "Record accrual"
                      : "تسجيل الاستحقاق"
                    : locale === "en"
                      ? "Record payment"
                      : "تسجيل الصرف"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/accounting/leave-pay`}
              className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
