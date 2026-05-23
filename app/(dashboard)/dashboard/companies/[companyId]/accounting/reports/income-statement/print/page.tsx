import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getIncomeStatement } from "@/lib/accounting/reports";
import { PrintControls } from "@/components/ui/print-controls";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; startDate?: string; endDate?: string }>;
}

export default async function IncomeStatementPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;

  const fiscalYear = sp.fiscalYearId
    ? await prisma.fiscalYear.findUnique({ where: { id: sp.fiscalYearId } })
    : await prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true } });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true },
  });

  const startDate = sp.startDate ? new Date(sp.startDate) : undefined;
  const endDate = sp.endDate ? new Date(sp.endDate) : undefined;

  const report = fiscalYear
    ? await getIncomeStatement(companyId, fiscalYear.id, startDate, endDate)
    : null;

  const isProfit = (report?.netIncome ?? 0) >= 0;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
.page { max-width: 180mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .report-header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #1e3a8a; }
        .report-title { font-size: 1.1rem; font-weight: 600; margin-top: 0.3rem; }
        .report-sub { font-size: 0.85rem; color: #6b7280; margin-top: 0.2rem; }
        .print-date { font-size: 0.78rem; color: #9ca3af; margin-top: 0.2rem; }
        .section-label { padding: 0.4rem 0.8rem; font-weight: 700; font-size: 0.88rem; margin-top: 1rem; }
        .rev-label { background: #dcfce7; color: #166534; }
        .exp-label { background: #fee2e2; color: #991b1b; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        td { padding: 0.3rem 0.8rem; border-bottom: 1px solid #f3f4f6; }
        .header-row td { font-weight: 700; background: #f9fafb; }
        .num { text-align: left; font-variant-numeric: tabular-nums; width: 120px; }
        .total-row td { font-weight: 700; border-top: 2px solid #d1d5db; padding-top: 0.5rem; }
        .rev-total td { background: #dcfce7; color: #166534; }
        .exp-total td { background: #fee2e2; color: #991b1b; }
        .net-row { margin-top: 1rem; padding: 0.8rem 1rem; font-weight: 700; font-size: 1rem; border: 2px solid; display: flex; justify-content: space-between; }
        .net-profit { border-color: #059669; background: #ecfdf5; color: #065f46; }
        .net-loss { border-color: #dc2626; background: #fef2f2; color: #991b1b; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .summary-card { border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.8rem; text-align: center; }
        .summary-label { font-size: 0.78rem; color: #6b7280; margin-bottom: 0.3rem; }
        .summary-value { font-size: 1.1rem; font-weight: 700; }
        @media print {
          .controls { display: none !important; }
          body { background: white; }
          .page { border: none; padding: 0; margin: 0; max-width: 100%; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>

      <PrintControls backHref={`/dashboard/companies/${companyId}/accounting/reports/income-statement`} />

      <div className="page">
        <div className="report-header">
          <p className="company-name">{company?.nameAr}</p>
          {company?.nameEn && <p style={{ fontSize: "0.85rem", color: "#374151", direction: "ltr" }}>{company.nameEn}</p>}
          <p className="report-title">قائمة الدخل (الأرباح والخسائر)</p>
          <p className="report-sub">السنة المالية {fiscalYear?.year}</p>
          <p className="print-date">تاريخ الطباعة: {printDate}</p>
        </div>

        {!report ? (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>لا توجد بيانات</p>
        ) : (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <p className="summary-label">إجمالي الإيرادات</p>
                <p className="summary-value" style={{ color: "#059669" }}>{report.totalRevenue.toFixed(3)}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">إجمالي المصروفات</p>
                <p className="summary-value" style={{ color: "#dc2626" }}>{report.totalExpenses.toFixed(3)}</p>
              </div>
              <div className="summary-card">
                <p className="summary-label">{isProfit ? "صافي الربح" : "صافي الخسارة"}</p>
                <p className="summary-value" style={{ color: isProfit ? "#059669" : "#dc2626" }}>{Math.abs(report.netIncome).toFixed(3)}</p>
              </div>
            </div>

            {/* Revenues */}
            <div className="section-label rev-label">الإيرادات</div>
            <table>
              <tbody>
                {report.revenues.map((row, i) => (
                  <tr key={i} className={row.isHeader ? "header-row" : ""}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6b7280", width: "80px" }}>{row.code}</td>
                    <td style={{ paddingRight: `${(row.level ?? 0) * 1 + 0.5}rem` }}>{row.nameAr}</td>
                    <td className="num" style={{ color: "#059669" }}>{row.isHeader ? "" : row.amount.toFixed(3)}</td>
                  </tr>
                ))}
                <tr className="total-row rev-total">
                  <td colSpan={2}>إجمالي الإيرادات</td>
                  <td className="num">{report.totalRevenue.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>

            {/* Expenses */}
            <div className="section-label exp-label" style={{ marginTop: "1.5rem" }}>المصروفات</div>
            <table>
              <tbody>
                {report.expenses.map((row, i) => (
                  <tr key={i} className={row.isHeader ? "header-row" : ""}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6b7280", width: "80px" }}>{row.code}</td>
                    <td style={{ paddingRight: `${(row.level ?? 0) * 1 + 0.5}rem` }}>{row.nameAr}</td>
                    <td className="num" style={{ color: "#dc2626" }}>{row.isHeader ? "" : row.amount.toFixed(3)}</td>
                  </tr>
                ))}
                <tr className="total-row exp-total">
                  <td colSpan={2}>إجمالي المصروفات</td>
                  <td className="num">{report.totalExpenses.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>

            <div className={`net-row ${isProfit ? "net-profit" : "net-loss"}`} style={{ marginTop: "1.5rem" }}>
              <span>{isProfit ? "صافي الربح" : "صافي الخسارة"}</span>
              <span style={{ fontFamily: "monospace" }}>{Math.abs(report.netIncome).toFixed(3)} د.ك</span>
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
