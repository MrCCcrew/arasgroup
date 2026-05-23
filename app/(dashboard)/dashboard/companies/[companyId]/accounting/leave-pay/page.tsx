import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

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

export default async function LeavePayPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const labels = STATUS_LABELS[locale];

  const records = await prisma.leavePayCalc.findMany({
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

  const totalPaid = records
    .filter((record) => record.status === "PAID")
    .reduce((sum, record) => sum + Number(record.totalAmount), 0);
  const totalAccrued = records
    .filter((record) => record.status === "ACCRUED")
    .reduce((sum, record) => sum + Number(record.totalAmount), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Leave Pay" : "بدل الإجازة"}
        subtitle={locale === "en" ? "Leave settlement records under Kuwait labor policy" : "سجلات بدل الإجازة وفق سياسة العمل الكويتية"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/accounting/leave-pay/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New calculation" : "حساب جديد"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="stat-card">
            <span className="text-xs text-muted-foreground">
              {locale === "en" ? "Total accrued" : "إجمالي المستحق"}
            </span>
            <span className="number text-xl font-bold text-yellow-600">
              {formatKWD(totalAccrued, numberLocale)}
            </span>
          </div>
          <div className="stat-card">
            <span className="text-xs text-muted-foreground">
              {locale === "en" ? "Total paid" : "إجمالي المصروف"}
            </span>
            <span className="number text-xl font-bold text-green-600">
              {formatKWD(totalPaid, numberLocale)}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee" : "الموظف"}</th>
                  <th>{locale === "en" ? "Year" : "السنة"}</th>
                  <th>{locale === "en" ? "Days owed" : "الأيام المستحقة"}</th>
                  <th>{locale === "en" ? "Days used" : "الأيام المستخدمة"}</th>
                  <th>{locale === "en" ? "Days paid" : "أيام الصرف"}</th>
                  <th>{locale === "en" ? "Daily wage" : "الأجر اليومي"}</th>
                  <th>{locale === "en" ? "Total amount" : "الإجمالي"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Journal entry" : "القيد"}</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      {locale === "en" ? "No leave pay records yet" : "لا توجد سجلات بدل إجازة بعد"}
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const status = labels[record.status as keyof typeof labels] ?? labels.CALCULATED;
                    const employeeName =
                      locale === "en"
                        ? record.employee.nameEn ?? record.employee.nameAr
                        : record.employee.nameAr;

                    return (
                      <tr key={record.id} className="hover:bg-muted/10">
                        <td>
                          <p className="font-medium">{employeeName}</p>
                          {record.employee.employeeNumber && (
                            <p className="text-xs text-muted-foreground">{record.employee.employeeNumber}</p>
                          )}
                        </td>
                        <td className="text-center font-medium">{record.year}</td>
                        <td className="number text-center">{Number(record.leaveDaysOwed).toFixed(0)}</td>
                        <td className="number text-center">{Number(record.leaveDaysUsed).toFixed(0)}</td>
                        <td className="number text-center font-medium text-blue-600">
                          {Number(record.leaveDaysPaid).toFixed(0)}
                        </td>
                        <td className="number">{formatKWD(Number(record.dailyWage), numberLocale)}</td>
                        <td className="number font-bold text-blue-600">
                          {formatKWD(Number(record.totalAmount), numberLocale)}
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
