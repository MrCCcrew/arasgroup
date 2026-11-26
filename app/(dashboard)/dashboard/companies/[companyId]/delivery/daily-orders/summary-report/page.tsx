import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getDriverCashSummary, type DriverCashRow } from "@/lib/delivery/driver-cash-summary";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; driverId?: string; workStatus?: string; month?: string; year?: string }>;
}

const AR = {
  reportTitle: "تقرير تفصيلي مختصر للسائقين",
  printDate: "تاريخ الطباعة",
  totalDrivers: "إجمالي السائقين",
  totalOrders: "إجمالي الطلبات",
  totalCollected: "إجمالي المحصل",
  totalInvoices: "إجمالي الفواتير",
  tips: "الإكراميات",
  talabatDeposits: "إيداع طلبات",
  companyDeposits: "إيداع الشركة",
  totalWalletBalance: "إجمالي الرصيد الحالي",
  totalNetBalance: "إجمالي صافي الرصيد",
  selectedStatus: "الحالة المختارة",
  allStatuses: "كل الحالات",
  driver: "السائق",
  currentWalletBalance: "الرصيد الحالي في المحفظة",
  netBalance: "صافي الرصيد",
  ordersCount: "إجمالي الطلبات",
  kwd: "د.ك",
  worked: "عمل",
  onLeave: "إجازة",
  vehicleBreakdown: "عطل سيارة",
  noShifts: "بدون شيفتات",
  missedShift: "عنده شيفت ولم يعمل",
  lateLogin: "تأخر في تسجيل الدخول",
  absent: "غياب",
} as const;

const EN = {
  reportTitle: "Short Detailed Drivers Report",
  printDate: "Print Date",
  totalDrivers: "Total Drivers",
  totalOrders: "Total Orders",
  totalCollected: "Total Collected",
  totalInvoices: "Total Invoices",
  tips: "Tips",
  talabatDeposits: "Talabat deposits",
  companyDeposits: "Company deposits",
  totalWalletBalance: "Total Current Balance",
  totalNetBalance: "Total Net Balance",
  selectedStatus: "Selected Status",
  allStatuses: "All statuses",
  driver: "Driver",
  currentWalletBalance: "Current Wallet Balance",
  netBalance: "Net Balance",
  ordersCount: "Total Orders",
  kwd: "KWD",
  worked: "Worked",
  onLeave: "On leave",
  vehicleBreakdown: "Vehicle breakdown",
  noShifts: "No shifts",
  missedShift: "Missed shift",
  lateLogin: "Late login",
  absent: "Absent",
} as const;

const WORK_STATUS_LABELS = {
  ar: {
    WORKED: AR.worked,
    ON_LEAVE: AR.onLeave,
    VEHICLE_BREAKDOWN: AR.vehicleBreakdown,
    NO_SHIFTS: AR.noShifts,
    MISSED_SHIFT: AR.missedShift,
    LATE_LOGIN: AR.lateLogin,
    ABSENT: AR.absent,
  },
  en: {
    WORKED: EN.worked,
    ON_LEAVE: EN.onLeave,
    VEHICLE_BREAKDOWN: EN.vehicleBreakdown,
    NO_SHIFTS: EN.noShifts,
    MISSED_SHIFT: EN.missedShift,
    LATE_LOGIN: EN.lateLogin,
    ABSENT: EN.absent,
  },
} as const;

type WorkStatus = keyof typeof WORK_STATUS_LABELS.ar;

export default async function DailyOrdersSummaryReportPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const t = locale === "en" ? EN : AR;
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const isEnglish = locale === "en";

  // Default to current month/year if not specified
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());
  const effectiveMonth = sp.month ?? currentMonth;
  const effectiveYear = sp.year ?? currentYear;

  // Date filtering by month/year
  let dateFilter = {};
  if (effectiveMonth && effectiveYear) {
    const monthNum = Number.parseInt(effectiveMonth, 10);
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    dateFilter = { date: { gte: startDate, lte: endDate } };
  } else if (effectiveYear) {
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
    dateFilter = { date: { gte: startDate, lte: endDate } };
  }

  const where = {
    companyId,
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus as WorkStatus } : {}),
    ...dateFilter,
  };

  const [company, orders] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true },
    }),
    prisma.deliveryDailyOrder.findMany({
      where,
      select: {
        id: true,
        driverId: true,
        contractId: true,
        date: true,
        ordersCount: true,
        driver: {
          select: {
            employee: {
              select: {
                nameAr: true,
                nameEn: true,
              },
            },
          },
        },
      },
      orderBy: [{ driver: { employee: { nameAr: "asc" } } }, { date: "asc" }],
    }),
  ]);

  type SummaryOrder = typeof orders[number];
  const driverIds = [...new Set(orders.map((order: SummaryOrder) => order.driverId))];

  // Fetch only drivers that have orders in the filtered period
  const driverRows = driverIds.length > 0
    ? await prisma.driver.findMany({
        where: {
          id: { in: driverIds },
          employee: { companyId, isDeleted: false },
        },
        select: {
          id: true,
          walletBalance: true,
          employee: {
            select: {
              nameAr: true,
              nameEn: true,
            },
          },
        },
        orderBy: { employee: { nameAr: "asc" } },
      })
    : [];

  type SummaryDriver = typeof driverRows[number];

  const driverById = new Map<string, SummaryDriver>(driverRows.map((driver: SummaryDriver) => [driver.id, driver]));

  // نفس حساب صفحة الطلبات اليومية: المحصل − الإكراميات − الفواتير − إيداع طلبات − إيداع الشركة
  const cash = await getDriverCashSummary({ orderWhere: where, month: effectiveMonth, year: effectiveYear });

  type SummaryRowData = DriverCashRow & { driverName: string };
  const summaryRows: SummaryRowData[] = [];
  for (const [driverId, row] of cash.byDriver) {
    const driver = driverById.get(driverId);
    if (!driver) continue;
    summaryRows.push({ ...row, driverName: isEnglish ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr });
  }
  summaryRows.sort((a, b) => a.driverName.localeCompare(b.driverName, isEnglish ? "en" : "ar"));
  type SummaryRow = SummaryRowData;
  const totals = summaryRows.reduce(
    (acc, row: SummaryRow) => {
      acc.walletBalance += row.walletBalance;
      acc.totalCollected += row.collected;
      acc.tips += row.tips;
      acc.totalInvoices += row.invoices;
      acc.talabatDeposits += row.talabatDeposits;
      acc.companyDeposits += row.companyDeposits;
      acc.netBalance += row.netBalance;
      acc.totalOrders += row.orders;
      return acc;
    },
    { walletBalance: 0, totalCollected: 0, tips: 0, totalInvoices: 0, talabatDeposits: 0, companyDeposits: 0, netBalance: 0, totalOrders: 0 },
  );

  const backQuery = new URLSearchParams({
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus } : {}),
    month: effectiveMonth,
    year: effectiveYear,
  }).toString();
  const backHref = `/dashboard/companies/${companyId}/delivery/daily-orders${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString(numberLocale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: ${isEnglish ? "ltr" : "rtl"}; background: #f5f5f5; font-size: 11pt; }
        .page { max-width: 297mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.25rem; }
        .company { font-size: 1.4rem; font-weight: 700; }
        .sub { color: #6b7280; font-size: .9rem; margin-top: .25rem; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin-bottom: 1rem; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: .75rem; background: #fafafa; }
        .label { color: #6b7280; font-size: .8rem; margin-bottom: .2rem; }
        table { width: 100%; border-collapse: collapse; font-size: .82rem; }
        th { background: #111827; color: white; padding: .5rem; border: 1px solid #111827; }
        td { padding: .5rem; border: 1px solid #d1d5db; vertical-align: middle; }
        tr:nth-child(even) td { background: #f9fafb; }
        .number { font-variant-numeric: tabular-nums; }
        @media print {
          body { background: white; }
          .page { max-width: 100%; margin: 0; padding: 0; border: none; }
          @page { size: A4 landscape; margin: 1.2cm; }
        }
      `}</style>

      <PrintControls backHref={backHref} />

      <div className="page">
        <div className="header">
          <div className="company">{isEnglish ? company?.nameEn ?? company?.nameAr : company?.nameAr}</div>
          <div className="sub">{t.reportTitle}</div>
          <div className="sub">
            {t.printDate}: {printDate}
          </div>
        </div>

        <div className="meta">
          <div className="card">
            <div className="label">{t.totalDrivers}</div>
            <div>{summaryRows.length}</div>
          </div>
          <div className="card">
            <div className="label">{t.totalOrders}</div>
            <div>{totals.totalOrders}</div>
          </div>
          <div className="card">
            <div className="label">{t.selectedStatus}</div>
            <div>{sp.workStatus ? WORK_STATUS_LABELS[locale][sp.workStatus as WorkStatus] : t.allStatuses}</div>
          </div>
          <div className="card">
            <div className="label">{t.totalWalletBalance}</div>
            <div className="number">{totals.walletBalance.toFixed(3)} {t.kwd}</div>
          </div>
          <div className="card">
            <div className="label">{t.totalCollected}</div>
            <div className="number">{totals.totalCollected.toFixed(3)} {t.kwd}</div>
          </div>
          <div className="card">
            <div className="label">{t.totalInvoices}</div>
            <div className="number">{totals.totalInvoices.toFixed(3)} {t.kwd}</div>
          </div>
          <div className="card">
            <div className="label">{t.tips}</div>
            <div className="number">{totals.tips.toFixed(3)} {t.kwd}</div>
          </div>
          <div className="card">
            <div className="label">{t.talabatDeposits}</div>
            <div className="number">{totals.talabatDeposits.toFixed(3)} {t.kwd}</div>
          </div>
          <div className="card">
            <div className="label">{t.companyDeposits}</div>
            <div className="number">{totals.companyDeposits.toFixed(3)} {t.kwd}</div>
          </div>
        </div>

        <div className="meta" style={{ gridTemplateColumns: "1fr" }}>
          <div className="card">
            <div className="label">{t.totalNetBalance}</div>
            <div className="number">{totals.netBalance.toFixed(3)} {t.kwd}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t.driver}</th>
              <th>{t.currentWalletBalance}</th>
              <th>{t.totalCollected}</th>
              <th>{t.tips}</th>
              <th>{t.totalInvoices}</th>
              <th>{t.talabatDeposits}</th>
              <th>{t.companyDeposits}</th>
              <th>{t.netBalance}</th>
              <th>{t.ordersCount}</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center" }}>-</td>
              </tr>
            ) : (
              summaryRows.map((row: SummaryRow) => (
                <tr key={row.driverName}>
                  <td>{row.driverName}</td>
                  <td className="number">{row.walletBalance.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.collected.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.tips.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.invoices.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.talabatDeposits.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.companyDeposits.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.netBalance.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.orders}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
