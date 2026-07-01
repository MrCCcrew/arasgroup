import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; driverId?: string; workStatus?: string }>;
}

const AR = {
  reportTitle: "تقرير تفصيلي مختصر للسائقين",
  printDate: "تاريخ الطباعة",
  totalDrivers: "إجمالي السائقين",
  totalOrders: "إجمالي الطلبات",
  totalCollected: "إجمالي المحصل",
  totalInvoices: "إجمالي الفواتير",
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

  const where = {
    companyId,
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus as WorkStatus } : {}),
  };

  const [company, orders, driverRows] = await Promise.all([
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
    prisma.driver.findMany({
      where: {
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
    }),
  ]);

  const driverIds = [...new Set(orders.map((order) => order.driverId))];

  const [charges, totalInvoicesAmount] = await Promise.all([
    driverIds.length > 0
      ? prisma.driverWalletTransaction.findMany({
          where: {
            type: "CHARGE",
            driverId: { in: driverIds },
          },
          select: {
            dailyOrderId: true,
            driverId: true,
            contractId: true,
            date: true,
            amount: true,
          },
        })
      : Promise.resolve([]),
    driverIds.length > 0
      ? prisma.deliveryInvoice.groupBy({
          by: ["driverId"],
          where: {
            targetType: "DRIVER",
            driverId: { in: driverIds },
            deletedAt: null,
          },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const chargeByOrder = new Map<string, number>();
  const chargeByKey = new Map<string, number>();
  for (const charge of charges) {
    const amount = Number(charge.amount);
    if (charge.dailyOrderId) {
      chargeByOrder.set(charge.dailyOrderId, (chargeByOrder.get(charge.dailyOrderId) ?? 0) + amount);
    }
    const key = `${charge.driverId}|${charge.contractId ?? ""}|${charge.date.toISOString().slice(0, 10)}`;
    chargeByKey.set(key, (chargeByKey.get(key) ?? 0) + amount);
  }

  const invoiceByDriverId = new Map(totalInvoicesAmount.map((row) => [row.driverId ?? "", Number(row._sum.amount ?? 0)]));
  const driverById = new Map(driverRows.map((driver) => [driver.id, driver]));

  const summaryMap = new Map<
    string,
    {
      driverName: string;
      walletBalance: number;
      totalCollected: number;
      totalInvoices: number;
      netBalance: number;
      totalOrders: number;
    }
  >();

  for (const order of orders) {
    const driver = driverById.get(order.driverId);
    if (!driver) continue;

    if (!summaryMap.has(order.driverId)) {
      const walletBalance = Number(driver.walletBalance);
      const totalInvoices = invoiceByDriverId.get(order.driverId) ?? 0;
      summaryMap.set(order.driverId, {
        driverName: isEnglish ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr,
        walletBalance,
        totalCollected: 0,
        totalInvoices,
        netBalance: walletBalance - totalInvoices,
        totalOrders: 0,
      });
    }

    const item = summaryMap.get(order.driverId)!;
    const collection =
      chargeByOrder.get(order.id) ??
      chargeByKey.get(`${order.driverId}|${order.contractId}|${order.date.toISOString().slice(0, 10)}`) ??
      0;

    item.totalCollected += collection;
    item.totalOrders += order.ordersCount;
  }

  const summaryRows = Array.from(summaryMap.values()).sort((a, b) => a.driverName.localeCompare(b.driverName, isEnglish ? "en" : "ar"));
  const totals = summaryRows.reduce(
    (acc, row) => {
      acc.walletBalance += row.walletBalance;
      acc.totalCollected += row.totalCollected;
      acc.totalInvoices += row.totalInvoices;
      acc.netBalance += row.netBalance;
      acc.totalOrders += row.totalOrders;
      return acc;
    },
    { walletBalance: 0, totalCollected: 0, totalInvoices: 0, netBalance: 0, totalOrders: 0 },
  );

  const backQuery = new URLSearchParams({
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus } : {}),
  }).toString();
  const backHref = `/dashboard/companies/${companyId}/delivery/daily-orders${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString(numberLocale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: ${isEnglish ? "ltr" : "rtl"}; background: #f5f5f5; font-size: 11pt; }
        .page { max-width: 210mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
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
          @page { size: A4 portrait; margin: 1.2cm; }
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
              <th>{t.totalInvoices}</th>
              <th>{t.netBalance}</th>
              <th>{t.ordersCount}</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>-</td>
              </tr>
            ) : (
              summaryRows.map((row) => (
                <tr key={row.driverName}>
                  <td>{row.driverName}</td>
                  <td className="number">{row.walletBalance.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.totalCollected.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.totalInvoices.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.netBalance.toFixed(3)} {t.kwd}</td>
                  <td className="number">{row.totalOrders}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
