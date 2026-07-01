import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; driverId?: string; workStatus?: string }>;
}

const AR = {
  worked: "عمل",
  onLeave: "إجازة",
  vehicleBreakdown: "عطل سيارة",
  noShifts: "بدون شيفتات",
  missedShift: "عنده شيفت ولم يعمل",
  lateLogin: "تأخر في تسجيل الدخول",
  absent: "غياب",
  reportTitle: "تقرير الطلبات اليومية المجمع",
  printDate: "تاريخ الطباعة",
  totalRecords: "إجمالي السجلات",
  totalDrivers: "إجمالي السائقين",
  totalOrders: "إجمالي الطلبات",
  walletBalance: "الرصيد الحالي",
  totalInvoices: "إجمالي الفواتير",
  netBalance: "صافي الرصيد",
  kwd: "د.ك",
  selectedStatus: "الحالة المختارة",
  allStatuses: "كل الحالات",
  driver: "السائق",
  contracts: "العقود",
  totalOrdersCol: "إجمالي الطلبات",
  dayRows: "عدد الأيام/السجلات",
  statuses: "الحالات",
  workedUnder: "عمل باسم",
  details: "تفاصيل السجلات",
  date: "التاريخ",
  contract: "العقد",
  status: "الحالة",
  ordersCount: "عدد الطلبات",
  notes: "ملاحظات",
  comma: "، ",
} as const;

const EN = {
  worked: "Worked",
  onLeave: "On leave",
  vehicleBreakdown: "Vehicle breakdown",
  noShifts: "No shifts",
  missedShift: "Missed shift",
  lateLogin: "Late login",
  absent: "Absent",
  reportTitle: "Daily Orders Summary Report",
  printDate: "Print Date",
  totalRecords: "Total Records",
  totalDrivers: "Total Drivers",
  totalOrders: "Total Orders",
  walletBalance: "Current Balance",
  totalInvoices: "Total Invoices",
  netBalance: "Net Balance",
  kwd: "KWD",
  selectedStatus: "Selected Status",
  allStatuses: "All statuses",
  driver: "Driver",
  contracts: "Contracts",
  totalOrdersCol: "Total Orders",
  dayRows: "Days / Rows",
  statuses: "Statuses",
  workedUnder: "Worked Under",
  details: "Record Details",
  date: "Date",
  contract: "Contract",
  status: "Status",
  ordersCount: "Orders Count",
  notes: "Notes",
  comma: ", ",
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

export default async function DailyOrdersPrintPage({ params, searchParams }: Props) {
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

  const [company, orders, selectedDriver, totalInvoicesAmount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true, logoUrl: true },
    }),
    prisma.deliveryDailyOrder.findMany({
      where,
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        operatedAsDriver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        contract: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: [{ driver: { employee: { nameAr: "asc" } } }, { date: "asc" }],
    }),
    sp.driverId
      ? prisma.driver.findUnique({
          where: { id: sp.driverId },
          select: { walletBalance: true },
        })
      : null,
    sp.driverId
      ? prisma.deliveryInvoice.aggregate({
          where: {
            targetType: "DRIVER",
            driverId: sp.driverId,
            deletedAt: null,
          },
          _sum: { amount: true },
        })
      : null,
  ]);

  const driverBalance = selectedDriver ? Number(selectedDriver.walletBalance) : null;
  const driverInvoicesTotal = totalInvoicesAmount?._sum.amount ? Number(totalInvoicesAmount._sum.amount) : 0;
  const netBalance = selectedDriver ? (driverBalance ?? 0) - driverInvoicesTotal : null;

  const grouped = new Map<
    string,
    {
      driverName: string;
      totalOrders: number;
      totalRows: number;
      statuses: Record<WorkStatus, number>;
      aliases: string[];
      contracts: string[];
    }
  >();

  for (const order of orders) {
    const key = order.driverId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        driverName: isEnglish ? order.driver.employee.nameEn ?? order.driver.employee.nameAr : order.driver.employee.nameAr,
        totalOrders: 0,
        totalRows: 0,
        statuses: {
          WORKED: 0,
          ON_LEAVE: 0,
          VEHICLE_BREAKDOWN: 0,
          NO_SHIFTS: 0,
          MISSED_SHIFT: 0,
          LATE_LOGIN: 0,
          ABSENT: 0,
        },
        aliases: [],
        contracts: [],
      });
    }

    const item = grouped.get(key)!;
    item.totalOrders += order.ordersCount;
    item.totalRows += 1;
    item.statuses[order.workStatus as WorkStatus] += 1;

    const aliasName = isEnglish ? order.operatedAsDriver?.employee.nameEn ?? order.operatedAsDriver?.employee.nameAr : order.operatedAsDriver?.employee.nameAr;
    if (aliasName && !item.aliases.includes(aliasName)) {
      item.aliases.push(aliasName);
    }

    const contractName = isEnglish ? order.contract.nameEn ?? order.contract.nameAr : order.contract.nameAr;
    if (!item.contracts.includes(contractName)) {
      item.contracts.push(contractName);
    }
  }

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
        .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: 1rem; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: .75rem; background: #fafafa; }
        .label { color: #6b7280; font-size: .8rem; margin-bottom: .2rem; }
        table { width: 100%; border-collapse: collapse; font-size: .78rem; }
        th { background: #111827; color: white; padding: .45rem; border: 1px solid #111827; }
        td { padding: .45rem; border: 1px solid #d1d5db; vertical-align: top; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge { display: inline-block; border-radius: 999px; padding: .15rem .5rem; background: #f3f4f6; margin: .1rem; }
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
          <div className="sub">{t.printDate}: {printDate}</div>
        </div>

        <div className="meta">
          <div className="card"><div className="label">{t.totalRecords}</div><div>{orders.length}</div></div>
          <div className="card"><div className="label">{t.totalDrivers}</div><div>{grouped.size}</div></div>
          <div className="card"><div className="label">{t.totalOrders}</div><div>{orders.reduce((sum, order) => sum + order.ordersCount, 0)}</div></div>
          <div className="card"><div className="label">{t.selectedStatus}</div><div>{sp.workStatus ? WORK_STATUS_LABELS[locale][sp.workStatus as WorkStatus] : t.allStatuses}</div></div>
        </div>

        {selectedDriver && (
          <div className="meta" style={{ marginBottom: "1rem" }}>
            <div className="card">
              <div className="label">{t.walletBalance}</div>
              <div style={{ color: (driverBalance ?? 0) > 0 ? "#dc2626" : "#059669", fontWeight: "bold" }}>
                {(driverBalance ?? 0).toFixed(3)} {t.kwd}
              </div>
            </div>
            <div className="card">
              <div className="label">{t.totalInvoices}</div>
              <div style={{ color: "#9333ea", fontWeight: "bold" }}>
                {driverInvoicesTotal.toFixed(3)} {t.kwd}
              </div>
            </div>
            <div className="card">
              <div className="label">{t.netBalance}</div>
              <div style={{ color: (netBalance ?? 0) >= 0 ? "#dc2626" : "#059669", fontWeight: "bold" }}>
                {(netBalance ?? 0).toFixed(3)} {t.kwd}
              </div>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>{t.driver}</th>
              <th>{t.contracts}</th>
              <th>{t.totalOrdersCol}</th>
              <th>{t.dayRows}</th>
              <th>{t.statuses}</th>
              <th>{t.workedUnder}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.values()).map((item) => (
              <tr key={item.driverName}>
                <td>{item.driverName}</td>
                <td>{item.contracts.join(t.comma) || "-"}</td>
                <td>{item.totalOrders}</td>
                <td>{item.totalRows}</td>
                <td>
                  {Object.entries(item.statuses)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => (
                      <span key={status} className="badge">
                        {WORK_STATUS_LABELS[locale][status as WorkStatus]}: {count}
                      </span>
                    ))}
                </td>
                <td>{item.aliases.length > 0 ? item.aliases.join(t.comma) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: ".4rem" }}>{t.details}</div>
          <table>
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.driver}</th>
                <th>{t.contract}</th>
                <th>{t.status}</th>
                <th>{t.workedUnder}</th>
                <th>{t.ordersCount}</th>
                <th>{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{formatDate(order.date, numberLocale)}</td>
                  <td>{isEnglish ? order.driver.employee.nameEn ?? order.driver.employee.nameAr : order.driver.employee.nameAr}</td>
                  <td>{isEnglish ? order.contract.nameEn ?? order.contract.nameAr : order.contract.nameAr}</td>
                  <td>{WORK_STATUS_LABELS[locale][order.workStatus as WorkStatus]}</td>
                  <td>{isEnglish ? order.operatedAsDriver?.employee.nameEn ?? order.operatedAsDriver?.employee.nameAr ?? "-" : order.operatedAsDriver?.employee.nameAr ?? "-"}</td>
                  <td>{order.ordersCount}</td>
                  <td>{order.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
