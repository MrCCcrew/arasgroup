import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { MonthlyReportsFilters } from "./filters";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ month?: string; year?: string; contractId?: string }>;
}

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
    select: { id: true, nameAr: true, nameEn: true, platform: true },
    orderBy: { nameAr: "asc" },
  });

  // Build where clause for daily orders
  const whereClause: {
    companyId: string;
    date?: { gte: Date; lt: Date };
    contractId?: string;
  } = {
    companyId,
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
  };

  // Add date range filter if month/year provided
  if (sp.month && sp.year) {
    const month = parseInt(sp.month);
    const year = parseInt(sp.year);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    whereClause.date = { gte: startDate, lt: endDate };
  } else if (sp.year) {
    const year = parseInt(sp.year);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    whereClause.date = { gte: startDate, lt: endDate };
  }

  // Query daily orders
  const dailyOrders = await prisma.deliveryDailyOrder.findMany({
    where: whereClause,
    include: {
      driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
      contract: { select: { nameAr: true, nameEn: true, platform: true } },
    },
    orderBy: [{ date: "desc" }],
  });

  // Group by driver and contract
  type ReportLine = {
    driverId: string;
    driverName: string;
    contractId: string;
    contractName: string;
    platform: string | null;
    ordersCount: number;
    grossAmount: number;
    walletDeducted: number;
    netAmount: number;
    tips: number | null;
  };

  const grouped = new Map<string, ReportLine>();

  dailyOrders.forEach((order: typeof dailyOrders[number]) => {
    const key = `${order.driverId}-${order.contractId}`;
    const existing = grouped.get(key);

    const grossAmount = order.grossAmount ? Number(order.grossAmount) : 0;
    const walletDeducted = order.walletDeducted ? Number(order.walletDeducted) : 0;
    const netAmount = grossAmount - walletDeducted;

    if (existing) {
      existing.ordersCount += order.ordersCount;
      existing.grossAmount += grossAmount;
      existing.walletDeducted += walletDeducted;
      existing.netAmount += netAmount;
      // Average tips
      if (order.tips && existing.tips) {
        existing.tips = (existing.tips + Number(order.tips)) / 2;
      } else if (order.tips) {
        existing.tips = Number(order.tips);
      }
    } else {
      grouped.set(key, {
        driverId: order.driverId,
        driverName: locale === "en"
          ? order.driver.employee.nameEn ?? order.driver.employee.nameAr
          : order.driver.employee.nameAr,
        contractId: order.contractId,
        contractName: locale === "en"
          ? order.contract.nameEn ?? order.contract.nameAr
          : order.contract.nameAr,
        platform: order.contract.platform,
        ordersCount: order.ordersCount,
        grossAmount,
        walletDeducted,
        netAmount,
        tips: order.tips ? Number(order.tips) : null,
      });
    }
  });

  const reports = Array.from(grouped.values());
  type MonthlyReportRow = typeof reports[number];

  // Calculate totals
  const totals = reports.reduce(
    (acc: { orders: number; gross: number; wallet: number; net: number }, report: MonthlyReportRow) => ({
      orders: acc.orders + report.ordersCount,
      gross: acc.gross + report.grossAmount,
      wallet: acc.wallet + report.walletDeducted,
      net: acc.net + report.netAmount,
    }),
    { orders: 0, gross: 0, wallet: 0, net: 0 }
  );

  return (
    <div>
      <Header
        title={locale === "en" ? "Monthly Reports" : "التقارير الشهرية"}
        subtitle={locale === "en" ? "Auto-generated from daily orders" : "تقرير تلقائي من الطلبات اليومية"}
        companyId={companyId}
      />
      <div className="page-container space-y-4">
        <MonthlyReportsFilters companyId={companyId} locale={locale} contracts={contracts} />

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Driver" : "السائق"}</th>
                  <th>{locale === "en" ? "Contract" : "العقد"}</th>
                  <th>{locale === "en" ? "Total orders" : "إجمالي الطلبات"}</th>
                  <th>{locale === "en" ? "Gross total" : "الإجمالي (د.ك)"}</th>
                  <th>{locale === "en" ? "Wallet deduction" : "خصم المحفظة"}</th>
                  <th>{locale === "en" ? "Net payment" : "صافي الدفع"}</th>
                  <th>{locale === "en" ? "Tips" : "إكراميات"}</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No data found. Try adjusting filters." : "لا توجد بيانات. جرب تغيير الفلاتر."}
                    </td>
                  </tr>
                ) : (
                  reports.map((report: MonthlyReportRow) => (
                    <tr key={`${report.driverId}-${report.contractId}`} className="hover:bg-muted/30">
                      <td className="font-medium">{report.driverName}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            report.platform === "TALABAT"
                              ? "bg-orange-50 text-orange-700"
                              : report.platform === "RO_POPS"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {report.contractName}
                        </span>
                      </td>
                      <td className="number text-center">{report.ordersCount}</td>
                      <td className="number font-bold text-blue-600">
                        {formatKWD(report.grossAmount, numberLocale)}
                      </td>
                      <td className="number text-red-600">
                        {formatKWD(report.walletDeducted, numberLocale)}
                      </td>
                      <td className="number font-bold text-green-600">
                        {formatKWD(report.netAmount, numberLocale)}
                      </td>
                      <td className="number text-center">
                        {report.tips ? report.tips.toFixed(2) : "—"}
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
