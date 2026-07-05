import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ driverId?: string; from?: string; to?: string }>;
}

const AR = {
  reportTitle: "تقرير إيداعات السائقين",
  printDate: "تاريخ الطباعة",
  depositsCount: "عدد الإيداعات",
  driversCount: "عدد السائقين",
  totalDeposits: "إجمالي المُودع",
  period: "الفترة",
  allTime: "كل الفترات",
  to: "إلى",
  summaryTitle: "ملخص حسب السائق",
  driver: "السائق",
  count: "عدد الإيداعات",
  total: "الإجمالي",
  details: "تفاصيل الإيداعات",
  date: "التاريخ",
  amount: "المبلغ",
  method: "طريقة الدفع",
  bank: "الحساب البنكي",
  notes: "ملاحظات",
  cash: "نقدي",
  bankWord: "بنك",
  grandTotal: "الإجمالي العام",
} as const;

const fmt = (n: number) =>
  `${n.toLocaleString("ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`;

export default async function DriverDepositsPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;

  const fromDate = sp.from ? new Date(sp.from) : undefined;
  const toDate = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;

  const where = {
    type: "DEPOSIT" as const,
    driver: { employee: { companyId } },
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(fromDate || toDate
      ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [company, deposits] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true } }),
    prisma.driverWalletTransaction.findMany({
      where,
      include: {
        driver: { include: { employee: { select: { nameAr: true } } } },
        bankAccount: { select: { nameAr: true, bankName: true } },
      },
      orderBy: [{ driver: { employee: { nameAr: "asc" } } }, { date: "asc" }],
    }),
  ]);
  type DepositPrintRow = typeof deposits[number];

  // ملخص لكل سائق
  const grouped = new Map<string, { driverName: string; count: number; total: number }>();
  for (const d of deposits) {
    const key = d.driverId;
    if (!grouped.has(key)) {
      grouped.set(key, { driverName: d.driver.employee.nameAr, count: 0, total: 0 });
    }
    const item = grouped.get(key)!;
    item.count += 1;
    item.total += Number(d.amount);
  }

  const grandTotal = deposits.reduce((sum: number, d: DepositPrintRow) => sum + Number(d.amount), 0);

  const backQuery = new URLSearchParams({
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  }).toString();
  const backHref = `/dashboard/companies/${companyId}/delivery/deposits${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });
  const periodLabel =
    sp.from || sp.to
      ? `${sp.from ? formatDate(new Date(sp.from), "ar-KW") : "…"} ${AR.to} ${sp.to ? formatDate(new Date(sp.to), "ar-KW") : "…"}`
      : AR.allTime;
  const methodLabel = (m: string | null) => (m === "BANK" ? AR.bankWord : AR.cash);

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
          <div className="sub">{AR.reportTitle}</div>
          <div className="sub">{AR.printDate}: {printDate}</div>
          <div className="sub">{AR.period}: {periodLabel}</div>
        </div>

        <div className="meta">
          <div className="card"><div className="label">{AR.depositsCount}</div><div>{deposits.length}</div></div>
          <div className="card"><div className="label">{AR.driversCount}</div><div>{grouped.size}</div></div>
          <div className="card"><div className="label">{AR.totalDeposits}</div><div>{fmt(grandTotal)}</div></div>
        </div>

        <div style={{ fontWeight: 700, marginBottom: ".4rem" }}>{AR.summaryTitle}</div>
        <table>
          <thead>
            <tr>
              <th>{AR.driver}</th>
              <th>{AR.count}</th>
              <th>{AR.total}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.values()).map((item: { driverName: string; count: number; total: number }) => (
              <tr key={item.driverName}>
                <td>{item.driverName}</td>
                <td>{item.count}</td>
                <td>{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{AR.grandTotal}</td>
              <td>{deposits.length}</td>
              <td>{fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: "1.25rem" }}>
          <div style={{ fontWeight: 700, marginBottom: ".4rem" }}>{AR.details}</div>
          <table>
            <thead>
              <tr>
                <th>{AR.date}</th>
                <th>{AR.driver}</th>
                <th>{AR.amount}</th>
                <th>{AR.method}</th>
                <th>{AR.bank}</th>
                <th>{AR.notes}</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d: DepositPrintRow) => (
                <tr key={d.id}>
                  <td>{formatDate(d.date, "ar-KW")}</td>
                  <td>{d.driver.employee.nameAr}</td>
                  <td>{fmt(Number(d.amount))}</td>
                  <td>{methodLabel(d.paymentMethod)}</td>
                  <td>{d.bankAccount ? `${d.bankAccount.nameAr} — ${d.bankAccount.bankName}` : "-"}</td>
                  <td>{d.descriptionAr ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
