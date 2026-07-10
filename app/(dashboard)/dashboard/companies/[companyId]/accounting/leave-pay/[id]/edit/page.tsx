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

interface LeavePayRecord {
  id: string;
  employeeId: string;
  year: number;
  leaveDaysUsed: number;
  notes: string | null;
  status: string;
  paymentMethod: string | null;
  bankAccountId: string | null;
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

export default function EditLeavePayPage() {
  const router = useRouter();
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const { locale } = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [record, setRecord] = useState<LeavePayRecord | null>(null);
  const [loading, setLoading] = useState(true);
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
      fetch(`/api/hr/leave-pay/${id}`).then((response) => response.json()),
    ]).then(([employeePayload, bankPayload, recordPayload]) => {
      if (employeePayload.success) setEmployees(employeePayload.data);
      if (bankPayload.success) setBankAccounts(bankPayload.data);

      if (recordPayload.success) {
        const data = recordPayload.data;
        setRecord(data);
        setForm({
          employeeId: data.employeeId,
          year: data.year,
          periodStartDate: data.periodStartDate ? new Date(data.periodStartDate).toISOString().split("T")[0] : "",
          periodEndDate: data.periodEndDate ? new Date(data.periodEndDate).toISOString().split("T")[0] : "",
          leaveDaysUsed: String(data.leaveDaysUsed || 0),
          leaveDaysOwed: String(data.leaveDaysOwed || 0),
          manualOverride: !!data.periodStartDate || !!data.periodEndDate,
          action: data.status === "PAID" ? "PAY" : data.status === "ACCRUED" ? "ACCRUE" : "CALCULATE",
          paymentMethod: data.paymentMethod || "CASH",
          bankAccountId: data.bankAccountId || "",
          notes: data.notes || "",
        });
      }
      setLoading(false);
    });
  }, [companyId, id]);

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

    const isAdministrative = ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "OFFICE_BOY"].includes(employee.type ?? "");
    const annualDays = isAdministrative ? 30 : (serviceYears >= 5 ? 35 : 30);

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
  }, [employee, form.year, form.periodStartDate, form.periodEndDate, form.leaveDaysUsed, form.leaveDaysOwed, form.manualOverride, locale]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!preview || preview.error) {
      setError(preview?.error || (locale === "en" ? "Please review the calculation" : "يرجى مراجعة الحساب"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        employeeId: form.employeeId,
        year: form.year,
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
      };

      const response = await fetch(`/api/hr/leave-pay/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || (locale === "en" ? "Save failed" : "فشل في الحفظ"));

      router.push(`/dashboard/companies/${companyId}/accounting/leave-pay`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">{locale === "en" ? "Loading..." : "جارٍ التحميل..."}</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page-container">
        <p className="text-red-600">{locale === "en" ? "Record not found" : "السجل غير موجود"}</p>
      </div>
    );
  }

  // Allow editing - journal entry validation happens on submit

  return (
    <div>
      <Header
        title={locale === "en" ? "Edit Leave Pay" : "تعديل بدل الإجازة"}
        subtitle={locale === "en" ? "Update leave pay calculation" : "تعديل حساب بدل الإجازة"}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/accounting/leave-pay`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back" : "العودة"}
        </Link>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Basic info" : "البيانات الأساسية"}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">
                  {locale === "en" ? "Employee" : "الموظف"} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(event) => setForm((previous) => ({ ...previous, employeeId: event.target.value }))}
                  className="input-field w-full"
                  disabled
                >
                  <option value="">{locale === "en" ? "Select..." : "اختر..."}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {locale === "en" ? emp.nameEn ?? emp.nameAr : emp.nameAr}
                      {emp.employeeNumber ? ` - ${emp.employeeNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  {locale === "en" ? "Year" : "السنة"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={2020}
                  max={2100}
                  value={form.year}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, year: Number.parseInt(event.target.value) }))
                  }
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">{locale === "en" ? "Period start date" : "تاريخ بداية الفترة"}</label>
                <input
                  type="date"
                  value={form.periodStartDate}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, periodStartDate: event.target.value, manualOverride: false }))
                  }
                  className="input-field w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "en"
                    ? "Leave blank to use full year calculation"
                    : "اتركه فارغاً لحساب السنة كاملة"}
                </p>
              </div>

              <div>
                <label className="form-label">{locale === "en" ? "Period end date" : "تاريخ نهاية الفترة"}</label>
                <input
                  type="date"
                  value={form.periodEndDate}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, periodEndDate: event.target.value, manualOverride: false }))
                  }
                  className="input-field w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">{locale === "en" ? "Leave days owed" : "أيام الإجازة المستحقة"}</label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  step="0.5"
                  value={form.leaveDaysOwed}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, leaveDaysOwed: event.target.value, manualOverride: true }))
                  }
                  className="input-field w-full"
                  placeholder={preview?.autoDaysOwed ? String(preview.autoDaysOwed) : ""}
                />
                {preview?.autoDaysOwed && !form.manualOverride && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locale === "en" ? "Auto-calculated:" : "محسوبة تلقائياً:"} {preview.autoDaysOwed}{" "}
                    {locale === "en" ? "days" : "يوم"}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">{locale === "en" ? "Leave days used" : "أيام الإجازة المستخدمة"}</label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  step="0.5"
                  value={form.leaveDaysUsed}
                  onChange={(event) => setForm((previous) => ({ ...previous, leaveDaysUsed: event.target.value }))}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {preview && !preview.error && (
            <div className="section-card">
              <div className="mb-4 flex items-center gap-2">
                <Calculator size={18} className="text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {locale === "en" ? "Calculation preview" : "معاينة الحساب"}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="stat-card text-center">
                  <span className="text-xs text-muted-foreground">
                    {locale === "en" ? "Days owed" : "أيام المستحقة"}
                  </span>
                  <span className="text-2xl font-bold">{preview.daysOwed}</span>
                </div>
                <div className="stat-card text-center">
                  <span className="text-xs text-muted-foreground">
                    {locale === "en" ? "Days used" : "أيام مستخدمة"}
                  </span>
                  <span className="text-2xl font-bold text-red-600">{preview.daysUsed}</span>
                </div>
                <div className="stat-card text-center">
                  <span className="text-xs text-muted-foreground">
                    {locale === "en" ? "Days to pay" : "أيام للصرف"}
                  </span>
                  <span className="text-2xl font-bold text-green-600">{preview.daysPaid}</span>
                </div>
                <div className="stat-card text-center">
                  <span className="text-xs text-muted-foreground">
                    {locale === "en" ? "Total amount" : "المبلغ الإجمالي"}
                  </span>
                  <span className="number text-2xl font-bold text-primary">{formatKWD(preview.total, numberLocale)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                {locale === "en" ? "Daily wage" : "الأجر اليومي"}:{" "}
                <span className="number font-medium">{formatKWD(preview.dailyWage, numberLocale)}</span>
              </div>
            </div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Action" : "الإجراء"}
            </h3>

            <div>
              <label className="form-label">
                {locale === "en" ? "What to do?" : "ماذا تريد أن تفعل؟"}
              </label>
              <select
                value={form.action}
                onChange={(event) => setForm((previous) => ({ ...previous, action: event.target.value }))}
                className="input-field w-full"
              >
                {(locale === "en" ? ACTIONS.en : ACTIONS.ar).map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>

            {form.action === "PAY" && (
              <>
                <div>
                  <label className="form-label">{locale === "en" ? "Payment method" : "طريقة الدفع"}</label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="CASH"
                        checked={form.paymentMethod === "CASH"}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, paymentMethod: event.target.value }))
                        }
                        className="cursor-pointer"
                      />
                      <span>{locale === "en" ? "Cash" : "نقدي"}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="BANK"
                        checked={form.paymentMethod === "BANK"}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, paymentMethod: event.target.value }))
                        }
                        className="cursor-pointer"
                      />
                      <span>{locale === "en" ? "Bank transfer" : "تحويل بنكي"}</span>
                    </label>
                  </div>
                </div>

                {form.paymentMethod === "BANK" && (
                  <div>
                    <label className="form-label">
                      {locale === "en" ? "Bank account" : "الحساب البنكي"} <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={form.bankAccountId}
                      onChange={(event) => setForm((previous) => ({ ...previous, bankAccountId: event.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="">{locale === "en" ? "Select..." : "اختر..."}</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {locale === "en" ? account.nameEn ?? account.nameAr : account.nameAr} - {account.bankName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="form-label">{locale === "en" ? "Notes" : "ملاحظات"}</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !preview || !!preview.error}
              className="btn-primary flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Update" : "تحديث"}
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
