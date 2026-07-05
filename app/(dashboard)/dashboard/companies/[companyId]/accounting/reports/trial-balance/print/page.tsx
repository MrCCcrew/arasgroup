import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { PrintControls } from "@/components/ui/print-controls";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string }>;
}

export default async function TrialBalancePrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;

  const fiscalYear = sp.fiscalYearId
    ? await prisma.fiscalYear.findUnique({ where: { id: sp.fiscalYearId } })
    : await prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true } });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true, logoUrl: true },
  });

  const rows = fiscalYear ? await getTrialBalance(companyId, fiscalYear.id) : [];
  type TrialBalanceRow = typeof rows[number];

  const totalOpeningDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.openingDebit, 0);
  const totalOpeningCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.openingCredit, 0);
  const totalPeriodDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.periodDebit, 0);
  const totalPeriodCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.periodCredit, 0);
  const totalClosingDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.closingDebit, 0);
  const totalClosingCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.closingCredit, 0);
  const isBalanced = Math.abs(totalClosingDebit - totalClosingCredit) < 0.001;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
.page { max-width: 210mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .report-header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 1rem; margin-bottom: 1.5rem; position: relative; }
        .report-header-inner { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 4px; background: white; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #1e3a8a; }
        .report-title { font-size: 1.1rem; font-weight: 600; margin-top: 0.3rem; }
        .report-sub { font-size: 0.85rem; color: #6b7280; margin-top: 0.2rem; }
        .print-date { font-size: 0.78rem; color: #9ca3af; margin-top: 0.2rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.5rem; }
        th { background: #1e3a8a; color: white; padding: 0.4rem 0.5rem; text-align: right; border: 1px solid #1e3a8a; font-weight: 600; font-size: 0.8rem; }
        td { padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; }
        tr:nth-child(even) td { background: #f9fafb; }
        .header-row td { background: #e8edf4 !important; font-weight: 700; }
        .num { text-align: left; font-variant-numeric: tabular-nums; }
        .total-row td { background: #1e3a8a !important; color: white !important; font-weight: 700; border-top: 2px solid #1e3a8a; }
        .balanced { color: #059669; font-weight: 600; font-size: 0.85rem; text-align: center; margin-top: 1rem; }
        .unbalanced { color: #dc2626; font-weight: 600; font-size: 0.85rem; text-align: center; margin-top: 1rem; }
        @media print {
          .controls { display: none !important; }
          body { background: white; }
          .page { border: none; padding: 0; margin: 0; max-width: 100%; }
          @page { size: A4 landscape; margin: 1.5cm; }
        }
      `}</style>

      <PrintControls backHref={`/dashboard/companies/${companyId}/accounting/reports/trial-balance`} />

      <div className="page">
        <div className="report-header">
          <div className="report-header-inner">
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.nameAr} className="company-logo" />
            )}
            <div>
              <p className="company-name">{company?.nameAr}</p>
              {company?.nameEn && <p style={{ fontSize: "0.85rem", color: "#374151", direction: "ltr" }}>{company.nameEn}</p>}
            </div>
          </div>
          <p className="report-title">ميزان المراجعة</p>
          <p className="report-sub">
            السنة المالية {fiscalYear?.year}
            {fiscalYear?.startDate && ` — ${new Date(fiscalYear.startDate).toLocaleDateString("ar-KW")} إلى ${new Date(fiscalYear.endDate!).toLocaleDateString("ar-KW")}`}
          </p>
          <p className="print-date">تاريخ الطباعة: {printDate}</p>
        </div>

        {rows.length === 0 ? (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>لا توجد بيانات</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "80px" }}>كود</th>
                  <th>اسم الحساب</th>
                  <th className="num" style={{ width: "90px" }}>اف. مدين</th>
                  <th className="num" style={{ width: "90px" }}>اف. دائن</th>
                  <th className="num" style={{ width: "90px" }}>حر. مدين</th>
                  <th className="num" style={{ width: "90px" }}>حر. دائن</th>
                  <th className="num" style={{ width: "90px" }}>خت. مدين</th>
                  <th className="num" style={{ width: "90px" }}>خت. دائن</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: TrialBalanceRow) => (
                  <tr key={row.accountId} className={row.isHeader ? "header-row" : ""}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{row.code}</td>
                    <td style={{ paddingRight: `${row.level * 0.8 + 0.5}rem`, fontWeight: row.isHeader ? 700 : 400 }}>{row.nameAr}</td>
                    <td className="num">{row.openingDebit > 0 ? row.openingDebit.toFixed(3) : "—"}</td>
                    <td className="num">{row.openingCredit > 0 ? row.openingCredit.toFixed(3) : "—"}</td>
                    <td className="num">{row.periodDebit > 0 ? row.periodDebit.toFixed(3) : "—"}</td>
                    <td className="num">{row.periodCredit > 0 ? row.periodCredit.toFixed(3) : "—"}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{row.closingDebit > 0 ? row.closingDebit.toFixed(3) : "—"}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{row.closingCredit > 0 ? row.closingCredit.toFixed(3) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2} style={{ textAlign: "center" }}>الإجمالي</td>
                  <td className="num">{totalOpeningDebit.toFixed(3)}</td>
                  <td className="num">{totalOpeningCredit.toFixed(3)}</td>
                  <td className="num">{totalPeriodDebit.toFixed(3)}</td>
                  <td className="num">{totalPeriodCredit.toFixed(3)}</td>
                  <td className="num">{totalClosingDebit.toFixed(3)}</td>
                  <td className="num">{totalClosingCredit.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
            <p className={isBalanced ? "balanced" : "unbalanced"}>
              {isBalanced ? "✓ الميزان متوازن" : `✗ فرق الميزان: ${Math.abs(totalClosingDebit - totalClosingCredit).toFixed(3)}`}
            </p>
          </>
        )}
      </div>
    </>
  );
}
