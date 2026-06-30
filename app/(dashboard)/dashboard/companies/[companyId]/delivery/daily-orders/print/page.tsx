import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; driverId?: string; workStatus?: string }>;
}

const AR = {
  worked: "\u0639\u0645\u0644",
  onLeave: "\u0625\u062c\u0627\u0632\u0629",
  vehicleBreakdown: "\u0639\u0637\u0644 \u0633\u064a\u0627\u0631\u0629",
  noShifts: "\u0628\u062f\u0648\u0646 \u0634\u064a\u0641\u062a\u0627\u062a",
  missedShift: "\u0639\u0646\u062f\u0647 \u0634\u064a\u0641\u062a \u0648\u0644\u0645 \u064a\u0639\u0645\u0644",
  lateLogin: "\u062a\u0623\u062e\u0631 \u0641\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
  reportTitle: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0627\u0644\u0645\u062c\u0645\u0639",
  printDate: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0637\u0628\u0627\u0639\u0629",
  totalRecords: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u062c\u0644\u0627\u062a",
  totalDrivers: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  totalOrders: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  walletBalance: "\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u062d\u0627\u0644\u064a",
  totalInvoices: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631",
  netBalance: "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0635\u064a\u062f",
  kwd: "\u062f.\u0643",
  selectedStatus: "\u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629",
  allStatuses: "\u0643\u0644 \u0627\u0644\u062d\u0627\u0644\u0627\u062a",
  driver: "\u0627\u0644\u0633\u0627\u0626\u0642",
  contracts: "\u0627\u0644\u0639\u0642\u0648\u062f",
  totalOrdersCol: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  dayRows: "\u0639\u062f\u062f \u0627\u0644\u0623\u064a\u0627\u0645/\u0627\u0644\u0633\u062c\u0644\u0627\u062a",
  statuses: "\u0627\u0644\u062d\u0627\u0644\u0627\u062a",
  workedUnder: "\u0639\u0645\u0644 \u0628\u0627\u0633\u0645",
  details: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0633\u062c\u0644\u0627\u062a",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  contract: "\u0627\u0644\u0639\u0642\u062f",
  status: "\u0627\u0644\u062d\u0627\u0644\u0629",
  ordersCount: "\u0639\u062f\u062f \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  arabicComma: "\u060c ",
} as const;

const WORK_STATUS_LABELS = {
  WORKED: AR.worked,
  ON_LEAVE: AR.onLeave,
  VEHICLE_BREAKDOWN: AR.vehicleBreakdown,
  NO_SHIFTS: AR.noShifts,
  MISSED_SHIFT: AR.missedShift,
  LATE_LOGIN: AR.lateLogin,
} as const;

type WorkStatus = keyof typeof WORK_STATUS_LABELS;

export default async function DailyOrdersPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;

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
        driver: { include: { employee: { select: { nameAr: true } } } },
        operatedAsDriver: { include: { employee: { select: { nameAr: true } } } },
        contract: { select: { nameAr: true } },
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
  const netBalance = selectedDriver ? driverBalance! - driverInvoicesTotal : null;

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
        driverName: order.driver.employee.nameAr,
        totalOrders: 0,
        totalRows: 0,
        statuses: {
          WORKED: 0,
          ON_LEAVE: 0,
          VEHICLE_BREAKDOWN: 0,
          NO_SHIFTS: 0,
          MISSED_SHIFT: 0,
          LATE_LOGIN: 0,
        },
        aliases: [],
        contracts: [],
      });
    }
    const item = grouped.get(key)!;
    item.totalOrders += order.ordersCount;
    item.totalRows += 1;
    item.statuses[order.workStatus as WorkStatus] += 1;
    if (order.operatedAsDriver?.employee.nameAr && !item.aliases.includes(order.operatedAsDriver.employee.nameAr)) {
      item.aliases.push(order.operatedAsDriver.employee.nameAr);
    }
    if (!item.contracts.includes(order.contract.nameAr)) {
      item.contracts.push(order.contract.nameAr);
    }
  }

  const backQuery = new URLSearchParams({
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus } : {}),
  }).toString();
  const backHref = `/dashboard/companies/${companyId}/delivery/daily-orders${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
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
        .muted { color: #6b7280; font-size: .72rem; }
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
          <div className="company">{company?.nameAr}</div>
          <div className="sub">{AR.reportTitle}</div>
          <div className="sub">{AR.printDate}: {printDate}</div>
        </div>

        <div className="meta">
          <div className="card"><div className="label">{AR.totalRecords}</div><div>{orders.length}</div></div>
          <div className="card"><div className="label">{AR.totalDrivers}</div><div>{grouped.size}</div></div>
          <div className="card"><div className="label">{AR.totalOrders}</div><div>{orders.reduce((sum, order) => sum + order.ordersCount, 0)}</div></div>
          <div className="card"><div className="label">{AR.selectedStatus}</div><div>{sp.workStatus ? WORK_STATUS_LABELS[sp.workStatus as WorkStatus] : AR.allStatuses}</div></div>
        </div>

        {selectedDriver && (
          <div className="meta" style={{ marginBottom: "1rem" }}>
            <div className="card">
              <div className="label">{AR.walletBalance}</div>
              <div style={{ color: (driverBalance ?? 0) > 0 ? "#dc2626" : "#059669", fontWeight: "bold" }}>
                {(driverBalance ?? 0).toFixed(3)} {AR.kwd}
              </div>
            </div>
            <div className="card">
              <div className="label">{AR.totalInvoices}</div>
              <div style={{ color: "#9333ea", fontWeight: "bold" }}>
                {driverInvoicesTotal.toFixed(3)} {AR.kwd}
              </div>
            </div>
            <div className="card">
              <div className="label">{AR.netBalance}</div>
              <div style={{ color: (netBalance ?? 0) >= 0 ? "#dc2626" : "#059669", fontWeight: "bold" }}>
                {(netBalance ?? 0).toFixed(3)} {AR.kwd}
              </div>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>{AR.driver}</th>
              <th>{AR.contracts}</th>
              <th>{AR.totalOrdersCol}</th>
              <th>{AR.dayRows}</th>
              <th>{AR.statuses}</th>
              <th>{AR.workedUnder}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.values()).map((item) => (
              <tr key={item.driverName}>
                <td>{item.driverName}</td>
                <td>{item.contracts.join(AR.arabicComma) || "-"}</td>
                <td>{item.totalOrders}</td>
                <td>{item.totalRows}</td>
                <td>
                  {Object.entries(item.statuses)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => (
                      <span key={status} className="badge">
                        {WORK_STATUS_LABELS[status as WorkStatus]}: {count}
                      </span>
                    ))}
                </td>
                <td>{item.aliases.length > 0 ? item.aliases.join(AR.arabicComma) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: ".4rem" }}>{AR.details}</div>
          <table>
            <thead>
              <tr>
                <th>{AR.date}</th>
                <th>{AR.driver}</th>
                <th>{AR.contract}</th>
                <th>{AR.status}</th>
                <th>{AR.workedUnder}</th>
                <th>{AR.ordersCount}</th>
                <th>{AR.notes}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{formatDate(order.date, "ar-KW")}</td>
                  <td>{order.driver.employee.nameAr}</td>
                  <td>{order.contract.nameAr}</td>
                  <td>{WORK_STATUS_LABELS[order.workStatus as WorkStatus]}</td>
                  <td>{order.operatedAsDriver?.employee.nameAr ?? "-"}</td>
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
