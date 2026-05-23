import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD, formatMonthYear } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

const statusLabels = {
  ar: {
    DRAFT: "مسودة",
    APPROVED: "معتمد",
    PAID: "مدفوع",
    CANCELLED: "ملغي",
  },
  en: {
    DRAFT: "Draft",
    APPROVED: "Approved",
    PAID: "Paid",
    CANCELLED: "Cancelled",
  },
} as const;

export default async function SalariesPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const batches = await prisma.salaryBatch.findMany({
    where: { companyId },
    include: { _count: { select: { payments: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const totalPaid = batches
    .filter((batch) => batch.status === "PAID")
    .reduce((sum, batch) => sum + Number(batch.totalNet), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Salary Batches" : "دفعات الرواتب"}
        subtitle={locale === "en" ? "Monthly salary cycles for company employees" : "الدورات الشهرية لرواتب موظفي الشركة"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New Batch" : "دفعة جديدة"}
          </Link>
        }
      />

      <div className="page-container space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold">{batches.length}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Salary batches" : "دفعات الرواتب"}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold text-green-600">{batches.filter((batch) => batch.status === "PAID").length}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Paid batches" : "دفعات مدفوعة"}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="text-xl font-bold number">{formatKWD(totalPaid, numberLocale)}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Total paid" : "إجمالي المدفوع"}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Period" : "الفترة"}</th>
                  <th>{locale === "en" ? "Cycle" : "نوع الدورة"}</th>
                  <th>{locale === "en" ? "Employees" : "عدد الموظفين"}</th>
                  <th>{locale === "en" ? "Gross total" : "إجمالي الرواتب"}</th>
                  <th>{locale === "en" ? "Net total" : "صافي المدفوع"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No salary batches found" : "لا توجد دفعات رواتب"}
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted/30">
                      <td className="font-medium">{formatMonthYear(batch.month, batch.year, numberLocale)}</td>
                      <td className="text-sm text-muted-foreground">{batch.cycleType}</td>
                      <td className="text-center">{batch._count.payments}</td>
                      <td className="font-bold number">{formatKWD(Number(batch.totalGross), numberLocale)}</td>
                      <td className="font-bold number text-green-600">{formatKWD(Number(batch.totalNet), numberLocale)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            batch.status === "PAID"
                              ? "bg-green-50 text-green-700"
                              : batch.status === "APPROVED"
                                ? "bg-blue-50 text-blue-700"
                                : batch.status === "CANCELLED"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {statusLabels[locale][batch.status]}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/companies/${companyId}/hr/salaries/${batch.id}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Eye size={12} />
                          {locale === "en" ? "View" : "عرض"}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
