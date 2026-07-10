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
}

interface BankAccount {
  id: string;
  nameAr: string;
  nameEn?: string;
  bankName: string;
}

const TERMINATION_TYPES = {
  ar: [
    { value: "RESIGNATION", label: "استقالة" },
    { value: "TERMINATION", label: "إنهاء خدمة من صاحب العمل" },
    { value: "RETIREMENT", label: "تقاعد" },
    { value: "DEATH", label: "وفاة" },
  ],
  en: [
    { value: "RESIGNATION", label: "Resignation" },
    { value: "TERMINATION", label: "Termination by employer" },
    { value: "RETIREMENT", label: "Retirement" },
    { value: "DEATH", label: "Death" },
  ],
} as const;

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

function calculatePreview(
  joinDate: string,
  lastWorkingDay: string,
  salary: number,
  terminationType: string,
  locale: "ar" | "en",
) {
  if (!joinDate || !lastWorkingDay || !salary) return null;

  const totalDays = Math.floor((new Date(lastWorkingDay).getTime() - new Date(joinDate).getTime()) / 86400000);
  if (totalDays < 365) {
    return {
      error: locale === "en" ? "Service period is less than one year" : "مدة الخدمة أقل من سنة",
    };
  }

  const serviceYears = totalDays / 365;
  const dailyWage = salary / 30; // Kuwaiti labor law: monthly salary / 30
  const grossDays = serviceYears <= 5 ? serviceYears * 15 : 5 * 15 + (serviceYears - 5) * 30;

  let deductionPct = 100;
  if (terminationType === "RESIGNATION") {
    if (serviceYears < 3) deductionPct = 0;
    else if (serviceYears < 5) deductionPct = 50;
    else if (serviceYears < 10) deductionPct = 75;
  }

  const gross = grossDays * dailyWage;
  const net = (gross * deductionPct) / 100;

  return {
    years: serviceYears,
    dailyWage,
    grossDays,
    gross,
    deductionPct,
    net,
  };
}

export default function NewEndOfServicePage() {
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
    terminationType: "RESIGNATION",
    lastWorkingDay: new Date().toISOString().split("T")[0],
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
  const preview = useMemo(
    () =>
      employee?.joinDate
        ? calculatePreview(
            employee.joinDate.split("T")[0],
            form.lastWorkingDay,
            Number(employee.baseSalary ?? 0),
            form.terminationType,
            locale,
          )
        : null,
    [employee?.baseSalary, employee?.joinDate, form.lastWorkingDay, form.terminationType, locale],
  );

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/hr/end-of-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      }
      router.push(`/dashboard/companies/${companyId}/accounting/end-of-service`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const employeeName = employee ? (locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr) : "";

  return (
    <div>
      <Header
        title={locale === "en" ? "End of Service Calculation" : "حساب مكافأة نهاية الخدمة"}
        subtitle={locale === "en" ? "Indemnity calculation under Kuwait labor law" : "احتساب المكافأة وفق قانون العمل الكويتي"}
        companyId={companyId}
      />
      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/accounting/end-of-service`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to end of service" : "العودة إلى نهاية الخدمة"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Employee details" : "بيانات الموظف"}
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
                <>
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {locale === "en" ? "Daily wage = base salary / 26" : "الأجر اليومي = الراتب الأساسي ÷ 26"}
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Termination reason" : "سبب إنهاء الخدمة"}
                </label>
                <select
                  value={form.terminationType}
                  onChange={(event) => setField("terminationType", event.target.value)}
                  className="input-field w-full"
                >
                  {TERMINATION_TYPES[locale].map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Last working day" : "آخر يوم عمل"}
                </label>
                <input
                  type="date"
                  value={form.lastWorkingDay}
                  onChange={(event) => setField("lastWorkingDay", event.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {preview && !("error" in preview) && (
            <div className="section-card space-y-3 border-2 border-primary/20 bg-primary/5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Calculator size={16} />
                {locale === "en" ? "Calculation preview" : "نتيجة الحساب"}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <PreviewBox
                  label={locale === "en" ? "Service years" : "سنوات الخدمة"}
                  value={preview.years.toFixed(2)}
                />
                <PreviewBox
                  label={locale === "en" ? "Daily wage" : "الأجر اليومي"}
                  value={formatKWD(preview.dailyWage, numberLocale)}
                />
                <PreviewBox
                  label={locale === "en" ? "Gross days" : "أيام المكافأة"}
                  value={preview.grossDays.toFixed(1)}
                />
                <PreviewBox
                  label={locale === "en" ? "Gross indemnity" : "المكافأة الإجمالية"}
                  value={formatKWD(preview.gross, numberLocale)}
                />
              </div>
              {form.terminationType === "RESIGNATION" && preview.deductionPct < 100 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  {locale === "en" ? "Eligibility percentage due to resignation:" : "نسبة الاستحقاق بسبب الاستقالة:"}{" "}
                  <strong>{preview.deductionPct}%</strong>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">
                  {locale === "en" ? "Net indemnity:" : "صافي المكافأة المستحقة:"}
                </span>
                <span className="number text-2xl font-bold text-green-600">
                  {formatKWD(preview.net, numberLocale)}
                </span>
              </div>
            </div>
          )}

          {preview && "error" in preview && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {preview.error}
            </div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Accounting action" : "الإجراء المحاسبي"}
            </h3>
            <div className="space-y-2">
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
            </div>

            {form.action === "PAY" && (
              <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
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
              href={`/dashboard/companies/${companyId}/accounting/end-of-service`}
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
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="number text-sm font-bold">{value}</p>
    </div>
  );
}
