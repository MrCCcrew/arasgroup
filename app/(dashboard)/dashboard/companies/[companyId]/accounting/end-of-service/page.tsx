import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { CalcRowActions } from "@/components/hr/calc-row-actions";

interface Props {
  params: Promise<{ companyId: string }>;
}

const STATUS_LABELS = {
  ar: {
    CALCULATED: { label: "محسوب", color: "bg-gray-100 text-gray-700" },
    ACCRUED: { label: "مستحق", color: "bg-yellow-100 text-yellow-700" },
    PAID: { label: "مصروف", color: "bg-green-100 text-green-700" },
  },
  en: {
    CALCULATED: { label: "Calculated", color: "bg-gray-100 text-gray-700" },
    ACCRUED: { label: "Accrued", color: "bg-yellow-100 text-yellow-700" },
    PAID: { label: "Paid", color: "bg-green-100 text-green-700" },
  },
} as const;

const TERMINATION_LABELS = {
  ar: {
    RESIGNATION: "استقالة",
    TERMINATION: "إنهاء خدمة",
    RETIREMENT: "تقاعد",
    DEATH: "وفاة",
  },
  en: {
    RESIGNATION: "Resignation",
    TERMINATION: "Termination",
    RETIREMENT: "Retirement",
    DEATH: "Death",
  },
} as const;

export default async function EndOfServicePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const statusLabels = STATUS_LABELS[locale];
  const terminationLabels = TERMINATION_LABELS[locale];

  const records = await prisma.endOfServiceCalc.findMany({
    where: { companyId },
    include: {
      employee: {
        select: {
          nameAr: true,
          nameEn: true,
          employeeNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = records.reduce(
    (accumulator, record) => {
      if (record.status === "CALCULATED") accumulator.calculated += Number(record.netIndemnity);
      if (record.status === "ACCRUED") accumulator.accrued += Number(record.netIndemnity);
      if (record.status === "PAID") accumulator.paid += Number(record.netIndemnity);
      return accumulator;
    },
    { calculated: 0, accrued: 0, paid: 0 },
  );

  return (
    <div>
      <Header
        title={locale === "en" ? "End of Service" : "مكافأة نهاية الخدمة"}
        subtitle={locale === "en" ? "End-of-service indemnity records" : "سجلات احتساب مكافأة نهاية الخدمة"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/accounting/end-of-service/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New calculation" : "حساب جديد"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="stat-card">
            <span className="text-xs text-muted-foreground">
              {locale === "en" ? "Calculated only" : "محسوب فقط"}
            </span>
            <span className="number text-xl font-bold">
              {formatKWD(totals.calculated, numberLocale)}
            </span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-muted-foreground">
              {locale === "en" ? "Accrued" : "مستحق"}
            </span>
            <span className="number text-xl font-bold text-yellow-600">
              {formatKWD(totals.accrued, numberLocale)}
            </span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-muted-foreground">
              {locale === "en" ? "Paid" : "تم الصرف"}
            </span>
            <span className="number text-xl font-bold text-green-600">
              {formatKWD(totals.paid, numberLocale)}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee" : "الموظف"}</th>
                  <th>{locale === "en" ? "Termination reason" : "سبب الإنهاء"}</th>
                  <th>{locale === "en" ? "Last working day" : "آخر يوم"}</th>
                  <th>{locale === "en" ? "Service years" : "سنوات الخدمة"}</th>
                  <th>{locale === "en" ? "Daily wage" : "الأجر اليومي"}</th>
                  <th>{locale === "en" ? "Gross indemnity" : "المكافأة الإجمالية"}</th>
                  <th>{locale === "en" ? "Deduction %" : "نسبة الخصم"}</th>
                  <th>{locale === "en" ? "Net indemnity" : "صافي المكافأة"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Journal entry" : "القيد"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-muted-foreground">
                      {locale === "en" ? "No end-of-service records yet" : "لا توجد سجلات نهاية خدمة بعد"}
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const status = statusLabels[record.status as keyof typeof statusLabels] ?? statusLabels.CALCULATED;
                    const employeeName =
                      locale === "en"
                        ? record.employee.nameEn ?? record.employee.nameAr
                        : record.employee.nameAr;
                    const terminationLabel =
                      terminationLabels[
                        record.terminationType as keyof typeof terminationLabels
                      ] ?? record.terminationType;

                    return (
                      <tr key={record.id} className="hover:bg-muted/10">
                        <td>
                          <p className="font-medium">{employeeName}</p>
                          {record.employee.employeeNumber && (
                            <p className="text-xs text-muted-foreground">{record.employee.employeeNumber}</p>
                          )}
                        </td>
                        <td>{terminationLabel}</td>
                        <td className="text-sm">{formatDate(record.lastWorkingDay, numberLocale)}</td>
                        <td className="number text-center">{Number(record.serviceYears).toFixed(2)}</td>
                        <td className="number">{formatKWD(Number(record.dailyWage), numberLocale)}</td>
                        <td className="number">{formatKWD(Number(record.grossIndemnity), numberLocale)}</td>
                        <td className="number text-center">{Number(record.deductionPct).toFixed(0)}%</td>
                        <td className="number font-bold text-green-600">
                          {formatKWD(Number(record.netIndemnity), numberLocale)}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="text-center">
                          {record.journalEntryId ? (
                            <Link
                              href={`/dashboard/companies/${companyId}/accounting/journal-entries/${record.journalEntryId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {locale === "en" ? "View" : "عرض"}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td>
                          <CalcRowActions
                            calcId={record.id}
                            calcType="end-of-service"
                            status={record.status as "CALCULATED" | "ACCRUED" | "PAID"}
                            notes={record.notes}
                            paidDate={record.paidDate?.toISOString() ?? null}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
