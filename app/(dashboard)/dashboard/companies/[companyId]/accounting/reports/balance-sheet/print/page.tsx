import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getBalanceSheet } from "@/lib/accounting/reports";
import { PrintControls } from "@/components/ui/print-controls";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; asOfDate?: string }>;
}

export default async function BalanceSheetPrintPage({ params, searchParams }: Props) {
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

  const asOfDate = sp.asOfDate ? new Date(sp.asOfDate) : undefined;
  const report = fiscalYear ? await getBalanceSheet(companyId, fiscalYear.id, asOfDate) : null;

  const isBalanced = report
    ? Math.abs(report.totalAssets - (report.totalLiabilities + report.totalEquity + report.netIncome)) < 0.01
    : false;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
.page { max-width: 210mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .report-header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .report-header-inner { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 4px; background: white; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #1e3a8a; }
        .report-title { font-size: 1.1rem; font-weight: 600; margin-top: 0.3rem; }
        .report-sub { font-size: 0.85rem; color: #6b7280; margin-top: 0.2rem; }
        .print-date { font-size: 0.78rem; color: #9ca3af; margin-top: 0.2rem; }
        .balance-status { text-align: center; padding: 0.4rem; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; border-radius: 0.4rem; }
        .balanced { background: #dcfce7; color: #166534; }
        .unbalanced { background: #fee2e2; color: #991b1b; }
        .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .section-label { padding: 0.4rem 0.8rem; font-weight: 700; font-size: 0.88rem; margin-bottom: 0; }
        .assets-label { background: #dbeafe; color: #1e40af; }
        .liab-label { background: #ffedd5; color: #9a3412; }
        .equity-label { background: #dcfce7; color: #166534; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        td { padding: 0.28rem 0.6rem; border-bottom: 1px solid #f3f4f6; }
        .header-row td { font-weight: 700; background: #f9fafb; }
        .num { text-align: left; font-variant-numeric: tabular-nums; width: 100px; }
        .total-row td { font-weight: 700; border-top: 2px solid #d1d5db; }
        .assets-total td { background: #dbeafe; color: #1e40af; }
        .liab-total td { background: #ffedd5; color: #9a3412; }
        .equity-total td { background: #dcfce7; color: #166534; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .summary-card { border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.8rem; text-align: center; }
        .summary-label { font-size: 0.78rem; color: #6b7280; margin-bottom: 0.3rem; }
        .summary-value { font-size: 1.05rem; font-weight: 700; }
        @media print {
          .controls { display: none !important; }
          body { background: white; }
          .page { border: none; padding: 0; margin: 0; max-width: 100%; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>

      <PrintControls backHref={`/dashboard/companies/${companyId}/accounting/reports/balance-sheet`} />

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
          <p className="report-title">الميزانية العمومية</p>
          <p className="report-sub">
            {asOfDate
              ? `بتاريخ ${asOfDate.toLocaleDateString("ar-KW")}`
              : `السنة المالية ${fiscalYear?.year}`}
          </p>
          <p className="print-date">تاريخ الطباعة: {printDate}</p>
        </div>

        {!report ? (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>لا توجد بيانات</p>
        ) : (
          <>
            <div className={`balance-status ${isBalanced ? "balanced" : "unbalanced"}`}>
              {isBalanced ? "✓ الميزانية متوازنة" : "✗ الميزانية غير متوازنة"}
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <p className="summary-label">إجمالي الأصول</p>
                <p className="summary-value" style={{ color: "#1e40af" }}>{report.totalAssets.toFixed(3)}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">إجمالي الالتزامات</p>
                <p className="summary-value" style={{ color: "#9a3412" }}>{report.totalLiabilities.toFixed(3)}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">حقوق الملكية</p>
                <p className="summary-value" style={{ color: "#166534" }}>{(report.totalEquity + report.netIncome).toFixed(3)}</p>
              </div>
            </div>

            <div className="cols">
              {/* Assets column */}
              <div>
                <div className="section-label assets-label">الأصول</div>
                <table>
                  <tbody>
                    {report.assets.map((row, i) => (
                      <tr key={i} className={row.isHeader ? "header-row" : ""}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#6b7280", width: "60px" }}>{row.code}</td>
                        <td style={{ paddingRight: `${(row.level ?? 0) * 0.8 + 0.3}rem` }}>{row.nameAr}</td>
                        <td className="num" style={{ color: "#1e40af" }}>{row.isHeader ? "" : row.amount.toFixed(3)}</td>
                      </tr>
                    ))}
                    <tr className="total-row assets-total">
                      <td colSpan={2}>إجمالي الأصول</td>
                      <td className="num">{report.totalAssets.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Liabilities + Equity column */}
              <div>
                <div className="section-label liab-label">الالتزامات</div>
                <table>
                  <tbody>
                    {report.liabilities.map((row, i) => (
                      <tr key={i} className={row.isHeader ? "header-row" : ""}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#6b7280", width: "60px" }}>{row.code}</td>
                        <td style={{ paddingRight: `${(row.level ?? 0) * 0.8 + 0.3}rem` }}>{row.nameAr}</td>
                        <td className="num" style={{ color: "#9a3412" }}>{row.isHeader ? "" : row.amount.toFixed(3)}</td>
                      </tr>
                    ))}
                    <tr className="total-row liab-total">
                      <td colSpan={2}>إجمالي الالتزامات</td>
                      <td className="num">{report.totalLiabilities.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-label equity-label" style={{ marginTop: "1rem" }}>حقوق الملكية</div>
                <table>
                  <tbody>
                    {report.equity.map((row, i) => (
                      <tr key={i} className={row.isHeader ? "header-row" : ""}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#6b7280", width: "60px" }}>{row.code}</td>
                        <td style={{ paddingRight: `${(row.level ?? 0) * 0.8 + 0.3}rem` }}>{row.nameAr}</td>
                        <td className="num" style={{ color: "#166534" }}>{row.isHeader ? "" : row.amount.toFixed(3)}</td>
                      </tr>
                    ))}
                    <tr className="header-row">
                      <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#6b7280" }}>—</td>
                      <td>{report.netIncome >= 0 ? "صافي الربح للفترة" : "صافي خسارة الفترة"}</td>
                      <td className="num" style={{ color: report.netIncome >= 0 ? "#166534" : "#dc2626" }}>{report.netIncome.toFixed(3)}</td>
                    </tr>
                    <tr className="total-row equity-total">
                      <td colSpan={2}>إجمالي حقوق الملكية</td>
                      <td className="num">{(report.totalEquity + report.netIncome).toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: "3rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", textAlign: "center" }}>
              {["المحاسب", "المراجع", "المدير المالي"].map((label) => (
                <div key={label} style={{ borderTop: "1px solid #374151", paddingTop: "0.5rem", fontSize: "0.82rem", color: "#374151" }}>
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
