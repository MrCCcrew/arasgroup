"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, XCircle, DollarSign, Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SalaryWhatsAppButton } from "@/components/hr/salary-whatsapp-button";
import { useLocale } from "@/components/providers/locale-provider";
import { formatKWD, formatMonthYear } from "@/lib/utils";

const CYCLE_LABELS = {
  ar: {
    OWNER_STANDARD: "موظفو الشركة",
    ADMINISTRATIVE_26_DAY: "إداريون (26 يوم)",
    DELIVERY_28_DAY: "توصيل (28 يوم)",
    CAR_WASH_28_DAY: "غسيل سيارات (28 يوم)",
    INVESTOR_FIXED: "موظفو المسئول",
  },
  en: {
    OWNER_STANDARD: "Owner standard",
    ADMINISTRATIVE_26_DAY: "Administrative (26-day)",
    DELIVERY_28_DAY: "Delivery (28-day)",
    CAR_WASH_28_DAY: "Car wash (28-day)",
    INVESTOR_FIXED: "Investor fixed",
  },
} as const;

const STATUS_LABELS = {
  ar: { DRAFT: "مسودة", APPROVED: "معتمد", PAID: "مدفوع", CANCELLED: "ملغي" },
  en: { DRAFT: "Draft", APPROVED: "Approved", PAID: "Paid", CANCELLED: "Cancelled" },
} as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

interface Payment {
  id: string;
  employeeId: string;
  baseAmount: string | number;
  incentives: string | number;
  additionalEarnings: string | number;
  deductions: string | number;
  netAmount: string | number;
  attendanceDays?: string | number | null;
  targetOrders?: number | null;
  actualOrders?: number | null;
  walletAmount?: string | number | null;
  amountDeliveredByDriver?: string | number | null;
  notes?: string | null;
  employee: {
    id: string;
    nameAr: string;
    nameEn?: string | null;
    type: string;
    phone?: string | null;
    employeeNumber?: string | null;
  };
}

interface Batch {
  id: string;
  companyId: string;
  month: number;
  year: number;
  cycleType: string;
  status: string;
  totalGross: string | number;
  totalNet: string | number;
  notes?: string | null;
  payments: Payment[];
  branch?: { nameAr: string; nameEn?: string | null } | null;
}

export default function SalaryBatchDetailPage() {
  const params = useParams<{ companyId: string; batchId: string }>();
  const { companyId, batchId } = params;
  const { locale } = useLocale();
  const router = useRouter();
  const numLocale = locale === "en" ? "en-US" : "ar-KW";

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hr/salaries/${batchId}`);
      const payload = await res.json();
      if (payload.success) setBatch(payload.data);
      else setError(payload.error ?? (locale === "en" ? "Failed to load" : "فشل في التحميل"));
    } catch {
      setError(locale === "en" ? "Failed to load batch" : "تعذر تحميل دفعة الرواتب");
    } finally {
      setLoading(false);
    }
  }, [batchId, locale]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status: string) {
    if (!batch) return;
    const confirmMsg = {
      APPROVED: locale === "en" ? "Approve this salary batch?" : "اعتماد دفعة الرواتب؟",
      PAID: locale === "en" ? "Mark this batch as paid?" : "تحديد دفعة الرواتب كمدفوعة؟",
      CANCELLED: locale === "en" ? "Cancel this salary batch?" : "إلغاء دفعة الرواتب؟",
    }[status];
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/hr/salaries/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      await load();
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : locale === "en" ? "Action failed" : "فشل الإجراء");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="page-container"><p className="text-muted-foreground">{locale === "en" ? "Loading..." : "جاري التحميل..."}</p></div>;
  if (error || !batch) return <div className="page-container"><p className="text-red-500">{error || (locale === "en" ? "Batch not found" : "الدفعة غير موجودة")}</p></div>;

  const title = formatMonthYear(batch.month, batch.year, numLocale);
  const cycleLabel = CYCLE_LABELS[locale][batch.cycleType as keyof typeof CYCLE_LABELS.ar] ?? batch.cycleType;

  return (
    <div>
      <Header
        title={locale === "en" ? "Salary Batch" : "دفعة الرواتب"}
        subtitle={`${title} — ${cycleLabel}`}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {batch.status === "DRAFT" && (
              <button
                onClick={() => updateStatus("APPROVED")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle size={15} />
                {locale === "en" ? "Approve" : "اعتماد"}
              </button>
            )}
            {batch.status === "APPROVED" && (
              <button
                onClick={() => updateStatus("PAID")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <DollarSign size={15} />
                {locale === "en" ? "Mark as paid" : "تسجيل كمدفوع"}
              </button>
            )}
            {(batch.status === "DRAFT" || batch.status === "APPROVED") && (
              <button
                onClick={() => updateStatus("CANCELLED")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle size={15} />
                {locale === "en" ? "Cancel" : "إلغاء"}
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Printer size={15} />
              {locale === "en" ? "Print" : "طباعة"}
            </button>
          </div>
        }
      />

      <div className="page-container space-y-5">
        <Link
          href={`/dashboard/companies/${companyId}/hr/salaries`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to salary batches" : "العودة لدفعات الرواتب"}
        </Link>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Period" : "الفترة"}</p>
            <p className="text-lg font-bold">{title}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Employees" : "الموظفون"}</p>
            <p className="text-lg font-bold">{batch.payments.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Gross total" : "الإجمالي"}</p>
            <p className="number text-lg font-bold">{formatKWD(Number(batch.totalGross), numLocale)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Net total" : "صافي المدفوع"}</p>
            <p className="number text-lg font-bold text-green-600">{formatKWD(Number(batch.totalNet), numLocale)}</p>
          </div>
        </div>

        {/* Status + info */}
        <div className="section-card flex flex-wrap items-center gap-4">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[batch.status] ?? "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABELS[locale][batch.status as keyof typeof STATUS_LABELS.ar] ?? batch.status}
          </span>
          <span className="text-sm text-muted-foreground">{cycleLabel}</span>
          {batch.branch && (
            <span className="text-sm text-muted-foreground">
              {locale === "en" ? batch.branch.nameEn ?? batch.branch.nameAr : batch.branch.nameAr}
            </span>
          )}
          {batch.notes && <span className="text-sm text-muted-foreground">{batch.notes}</span>}
        </div>

        {/* Payments table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee" : "الموظف"}</th>
                  <th>{locale === "en" ? "Days" : "الأيام"}</th>
                  <th>{locale === "en" ? "Base" : "أساسي"}</th>
                  <th>{locale === "en" ? "Incentive" : "حافز"}</th>
                  <th>{locale === "en" ? "Additions" : "إضافات"}</th>
                  <th>{locale === "en" ? "Deductions" : "خصومات"}</th>
                  <th>{locale === "en" ? "Net" : "الصافي"}</th>
                  <th>{locale === "en" ? "WhatsApp" : "واتساب"}</th>
                </tr>
              </thead>
              <tbody>
                {batch.payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No payments in this batch" : "لا توجد بيانات راتب في هذه الدفعة"}
                    </td>
                  </tr>
                ) : (
                  batch.payments.map((payment) => {
                    const name = locale === "en" ? payment.employee.nameEn ?? payment.employee.nameAr : payment.employee.nameAr;
                    const hasIncentive = Number(payment.incentives) > 0;
                    const hasAdditions = Number(payment.additionalEarnings) > 0;
                    const hasDeductions = Number(payment.deductions) > 0;

                    return (
                      <tr key={payment.id} className="hover:bg-muted/20">
                        <td>
                          <div>
                            <p className="font-medium">{name}</p>
                            {payment.employee.employeeNumber && (
                              <p className="text-xs text-muted-foreground">{payment.employee.employeeNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-center text-sm">
                          {payment.attendanceDays != null ? Number(payment.attendanceDays).toFixed(1) : "—"}
                        </td>
                        <td className="number font-medium">{formatKWD(Number(payment.baseAmount), numLocale)}</td>
                        <td className={`number ${hasIncentive ? "text-blue-600 font-medium" : "text-muted-foreground"}`}>
                          {hasIncentive ? formatKWD(Number(payment.incentives), numLocale) : "—"}
                        </td>
                        <td className={`number ${hasAdditions ? "text-green-600" : "text-muted-foreground"}`}>
                          {hasAdditions ? formatKWD(Number(payment.additionalEarnings), numLocale) : "—"}
                        </td>
                        <td className={`number ${hasDeductions ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          {hasDeductions ? formatKWD(Number(payment.deductions), numLocale) : "—"}
                        </td>
                        <td className="number font-bold text-green-700">
                          {formatKWD(Number(payment.netAmount), numLocale)}
                        </td>
                        <td>
                          <SalaryWhatsAppButton paymentId={payment.id} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {batch.payments.length > 0 && (
                <tfoot className="border-t-2 bg-muted/20 font-bold">
                  <tr>
                    <td colSpan={2} className="text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="number">{formatKWD(Number(batch.totalGross), numLocale)}</td>
                    <td colSpan={3}></td>
                    <td className="number text-green-700">{formatKWD(Number(batch.totalNet), numLocale)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
