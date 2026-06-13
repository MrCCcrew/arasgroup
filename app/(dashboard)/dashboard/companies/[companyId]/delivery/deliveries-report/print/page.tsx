import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; from?: string; to?: string; driverId?: string }>;
}

const AR = {
  kwd: "\u062f.\u0643",
  ellipsis: "\u2026",
  allPeriods: "\u0643\u0644 \u0627\u0644\u0641\u062a\u0631\u0627\u062a",
  to: "\u0625\u0644\u0649",
  reportTitle: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0651\u0644\u0629",
  printDate: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0637\u0628\u0627\u0639\u0629",
  period: "\u0627\u0644\u0641\u062a\u0631\u0629",
  deliveriesCount: "\u0639\u062f\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u0627\u062a",
  driversCount: "\u0639\u062f\u062f \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
  summaryByDriver: "\u0645\u0644\u062e\u0635 \u062d\u0633\u0628 \u0627\u0644\u0633\u0627\u0626\u0642",
  driver: "\u0627\u0644\u0633\u0627\u0626\u0642",
  count: "\u0627\u0644\u0639\u062f\u062f",
  grandTotal: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0639\u0627\u0645",
  details: "\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  restaurant: "\u0627\u0644\u0645\u0637\u0639\u0645",
  location: "\u0627\u0644\u0645\u0643\u0627\u0646",
  price: "\u0627\u0644\u0633\u0639\u0631",
} as const;

const fmt = (n: number) =>
  `${n.toLocaleString("ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${AR.kwd}`;

export default async function DeliveriesReportPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const contractId = sp.contractId ?? "";
  const fromDate = sp.from ? new Date(`${sp.from}T00:00:00.000`) : undefined;
  const toDate = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;

  const [company, contract, deliveries] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true } }),
    contractId ? prisma.deliveryContract.findUnique({ where: { id: contractId }, select: { nameAr: true } }) : null,
    contractId
      ? prisma.deliveryOrderDelivery.findMany({
          where: {
            contractId,
            ...(sp.driverId ? { driverId: sp.driverId } : {}),
            ...(fromDate || toDate
              ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
              : {}),
          },
          include: {
            restaurant: { select: { nameAr: true } },
            location: { select: { nameAr: true } },
            driver: { include: { employee: { select: { nameAr: true } } } },
          },
          orderBy: [{ driver: { employee: { nameAr: "asc" } } }, { date: "asc" }],
        })
      : [],
  ]);

  const grandTotal = deliveries.reduce((sum, delivery) => sum + Number(delivery.price) * delivery.count, 0);
  const totalOrders = deliveries.reduce((sum, delivery) => sum + delivery.count, 0);

  const byDriver = new Map<string, { name: string; count: number; total: number }>();
  for (const delivery of deliveries) {
    const row = byDriver.get(delivery.driverId) ?? { name: delivery.driver.employee.nameAr, count: 0, total: 0 };
    row.count += delivery.count;
    row.total += Number(delivery.price) * delivery.count;
    byDriver.set(delivery.driverId, row);
  }

  const backQuery = new URLSearchParams({
    ...(contractId ? { contractId } : {}),
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
  }).toString();
  const backHref = `/dashboard/companies/${companyId}/delivery/deliveries-report${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });
  const period =
    sp.from || sp.to
      ? `${sp.from ? formatDate(new Date(`${sp.from}T00:00:00`), "ar-KW") : AR.ellipsis} ${AR.to} ${sp.to ? formatDate(new Date(`${sp.to}T00:00:00`), "ar-KW") : AR.ellipsis}`
      : AR.allPeriods;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
        .page { max-width: 210mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.25rem; }
        .company { font-size: 1.4rem; font-weight: 700; }
        .sub { color: #6b7280; font-size: .9rem; margin-top: .25rem; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin-bottom: 1rem; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: .75rem; background: #fafafa; }
        .label { color: #6b7280; font-size: .8rem; margin-bottom: .2rem; }
        table { width: 100%; border-collapse: collapse; font-size: .78rem; }
        th { background: #111827; color: white; padding: .45rem; border: 1px solid #111827; }
        td { padding: .45rem; border: 1px solid #d1d5db; }
        tr:nth-child(even) td { background: #f9fafb; }
        tfoot td { background: #111827; color: white; font-weight: 700; }
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
          <div className="sub">{AR.reportTitle} — {contract?.nameAr ?? "-"}</div>
          <div className="sub">{AR.printDate}: {printDate} — {AR.period}: {period}</div>
        </div>

        <div className="meta">
          <div className="card"><div className="label">عدد الطلبات</div><div>{totalOrders}</div></div>
          <div className="card"><div className="label">{AR.driversCount}</div><div>{byDriver.size}</div></div>
          <div className="card"><div className="label">{AR.total}</div><div>{fmt(grandTotal)}</div></div>
        </div>

        <div style={{ fontWeight: 700, marginBottom: ".4rem" }}>{AR.summaryByDriver}</div>
        <table>
          <thead>
            <tr>
              <th>{AR.driver}</th>
              <th>{AR.count}</th>
              <th>{AR.total}</th>
            </tr>
          </thead>
          <tbody>
            {[...byDriver.values()].sort((a, b) => b.total - a.total).map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
                <td>{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{AR.grandTotal}</td>
              <td>{totalOrders}</td>
              <td>{fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: "1.25rem", fontWeight: 700, marginBottom: ".4rem" }}>{AR.details}</div>
        <table>
          <thead>
            <tr>
              <th>{AR.date}</th>
              <th>{AR.driver}</th>
              <th>{AR.restaurant}</th>
              <th>{AR.location}</th>
              <th>عدد الطلبات</th>
              <th>سعر الوحدة</th>
              <th>{AR.total}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>{formatDate(delivery.date, "ar-KW")}</td>
                <td>{delivery.driver.employee.nameAr}</td>
                <td>{delivery.restaurant.nameAr}</td>
                <td>{delivery.location.nameAr}</td>
                <td>{delivery.count}</td>
                <td>{fmt(Number(delivery.price))}</td>
                <td>{fmt(Number(delivery.price) * delivery.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
