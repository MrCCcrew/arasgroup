import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { ReportRowActions } from "./report-row-actions";
import { MonthlyReportsFilters } from "./filters";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ status?: string; month?: string; year?: string; contractId?: string }>;
}

const STATUS_LABELS = {
  ar: {
    DRAFT: "مسودة",
    SUBMITTED: "مقدم",
    POSTED: "مرحل",
    RECONCILED: "مسوى",
  },
  en: {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    POSTED: "Posted",
    RECONCILED: "Reconciled",
  },
} as const;

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

export default async function MonthlyReportsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  // Get all contracts for filters
  const contracts = await prisma.deliveryContract.findMany({
    where: { companyId, isActive: true },
    select: { id: true, nameAr: true, platform: true },
    orderBy: { nameAr: "asc" },
  });

  const reports = await prisma.deliveryMonthlyReport.findMany({
    where: {
      companyId,
      ...(sp.status ? { status: sp.status as never } : {}),
      ...(sp.month ? { month: parseInt(sp.month) } : {}),
      ...(sp.year ? { year: parseInt(sp.year) } : {}),
      ...(sp.contractId ? { contractId: sp.contractId } : {}),
    },
    include: { contract: { select: { nameAr: true, nameEn: true, platform: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Calculate totals
  const totals = reports.reduce(
    (acc: { orders: number; gross: number; wallet: number; net: number }, report) => ({
      orders: acc.orders + report.totalOrdersCount,
      gross: acc.gross + Number(report.totalGrossAmount),
      wallet: acc.wallet + Number(report.totalWalletDeducted),
      net: acc.net + Number(report.netPayment),
    }),
    { orders: 0, gross: 0, wallet: 0, net: 0 }
  );

  return (
    <div>
      <Header
        title={locale === "en" ? "Monthly Reports" : "التقارير الشهرية"}
        subtitle={locale === "en" ? "Monthly delivery reports and settlements" : "تقارير الطلبات والمدفوعات الشهرية"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/delivery/monthly-reports/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New Report" : "تقرير جديد"}
          </Link>
        }
      />
      <div className="page-container space-y-4">
        <MonthlyReportsFilters companyId={companyId} locale={locale} contracts={contracts} />

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Month / Year" : "الشهر / السنة"}</th>
                  <th>{locale === "en" ? "Contract" : "العقد"}</th>
                  <th>{locale === "en" ? "Total orders" : "إجمالي الطلبات"}</th>
                  <th>{locale === "en" ? "Gross total" : "الإجمالي (د.ك)"}</th>
                  <th>{locale === "en" ? "Wallet deduction" : "خصم المحفظة"}</th>
                  <th>{locale === "en" ? "Net payment" : "صافي الدفع"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th className="text-left">{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No reports found" : "لا توجد تقارير"}
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-muted/30">
                      <td className="font-medium">
                        {MONTHS[locale][report.month - 1]} {report.year}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            report.contract.platform === "TALABAT"
                              ? "bg-orange-50 text-orange-700"
                              : report.contract.platform === "RO_POPS"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {locale === "en" ? report.contract.nameEn ?? report.contract.nameAr : report.contract.nameAr}
                        </span>
                      </td>
                      <td className="number text-center">{report.totalOrdersCount}</td>
                      <td className="number font-bold text-blue-600">
                        {formatKWD(Number(report.totalGrossAmount), numberLocale)}
                      </td>
                      <td className="number text-red-600">
                        {formatKWD(Number(report.totalWalletDeducted), numberLocale)}
                      </td>
                      <td className="number font-bold text-green-600">
                        {formatKWD(Number(report.netPayment), numberLocale)}
                      </td>
                      <td>
                        <span className={`status-${report.status.toLowerCase()} rounded-full px-2 py-0.5 text-xs`}>
                          {STATUS_LABELS[locale][report.status as keyof typeof STATUS_LABELS.ar]}
                        </span>
                      </td>
                      <td>
                        <ReportRowActions companyId={companyId} reportId={report.id} locale={locale} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reports.length > 0 && (
                <tfoot className="border-t-2 border-primary/20 bg-muted/30">
                  <tr className="font-bold">
                    <td colSpan={2} className="text-right">
                      {locale === "en" ? "Totals:" : "الإجماليات:"}
                    </td>
                    <td className="number text-center">{totals.orders.toLocaleString(numberLocale)}</td>
                    <td className="number text-blue-600">{formatKWD(totals.gross, numberLocale)}</td>
                    <td className="number text-red-600">{formatKWD(totals.wallet, numberLocale)}</td>
                    <td className="number text-green-600">{formatKWD(totals.net, numberLocale)}</td>
                    <td colSpan={2}></td>
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
