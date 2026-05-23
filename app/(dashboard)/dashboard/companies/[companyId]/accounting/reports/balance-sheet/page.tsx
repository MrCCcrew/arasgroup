import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getBalanceSheet } from "@/lib/accounting/reports";
import { formatKWD } from "@/lib/utils";
import { CheckCircle, XCircle, FileDown } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/ui/print-button";
import { ExcelDownloadButton } from "@/components/ui/excel-download-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; asOfDate?: string }>;
}

export default async function BalanceSheetPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const fiscalYear = sp.fiscalYearId
    ? await prisma.fiscalYear.findUnique({ where: { id: sp.fiscalYearId } })
    : await prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true } });

  const allFiscalYears = await prisma.fiscalYear.findMany({
    where: { companyId },
    orderBy: { year: "desc" },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true },
  });

  const asOfDate = sp.asOfDate ? new Date(sp.asOfDate) : undefined;

  const report = fiscalYear
    ? await getBalanceSheet(companyId, fiscalYear.id, asOfDate)
    : null;

  const isBalanced = report
    ? Math.abs(report.totalAssets - (report.totalLiabilities + report.totalEquity + report.netIncome)) < 0.01
    : false;

  return (
    <div>
      <Header
        title="الميزانية العمومية"
        subtitle={`${company?.nameAr} — ${fiscalYear?.year ?? "—"}`}
        companyId={companyId}
        actions={
          <div className="flex gap-2">
            <PrintButton />
            {fiscalYear && (
              <Link
                href={`/dashboard/companies/${companyId}/accounting/reports/balance-sheet/print?fiscalYearId=${fiscalYear.id}${sp.asOfDate ? `&asOfDate=${sp.asOfDate}` : ""}`}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                <FileDown size={16} /> PDF
              </Link>
            )}
            {fiscalYear && (
              <ExcelDownloadButton
                url={`/api/reports/export?format=excel&type=balance_sheet&companyId=${companyId}&fiscalYearId=${fiscalYear.id}`}
                filename={`balance-sheet-${fiscalYear.year}.xlsx`}
                label="Excel"
              />
            )}
          </div>
        }
      />

      <div className="page-container">
        {/* Filters */}
        <form method="get" className="section-card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1.5">السنة المالية</label>
              <select
                name="fiscalYearId"
                defaultValue={fiscalYear?.id ?? ""}
                className="input-field"
              >
                {allFiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.year} {fy.isCurrent ? "(الحالية)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">بتاريخ</label>
              <input
                type="date"
                name="asOfDate"
                defaultValue={sp.asOfDate ?? ""}
                className="input-field"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              عرض
            </button>
          </div>
        </form>

        {!fiscalYear ? (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد سنة مالية. يرجى إنشاء سنة مالية أولاً.
          </div>
        ) : !report ? null : (
          <>
            {/* Balance check */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${isBalanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {isBalanced
                ? <><CheckCircle size={18} /> الميزانية متوازنة</>
                : <><XCircle size={18} /> الميزانية غير متوازنة — يرجى مراجعة القيود المحاسبية</>
              }
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card">
                <span className="text-sm text-muted-foreground">إجمالي الأصول</span>
                <span className="text-2xl font-bold text-blue-600 number">{formatKWD(report.totalAssets)}</span>
              </div>
              <div className="stat-card">
                <span className="text-sm text-muted-foreground">إجمالي الالتزامات</span>
                <span className="text-2xl font-bold text-orange-600 number">{formatKWD(report.totalLiabilities)}</span>
              </div>
              <div className="stat-card">
                <span className="text-sm text-muted-foreground">حقوق الملكية</span>
                <span className="text-2xl font-bold text-emerald-600 number">
                  {formatKWD(report.totalEquity + report.netIncome)}
                </span>
              </div>
            </div>

            {/* Report Header */}
            <div className="section-card text-center space-y-1">
              <h2 className="text-xl font-bold">{company?.nameAr}</h2>
              <p className="text-muted-foreground font-medium">الميزانية العمومية</p>
              <p className="text-sm">
                {asOfDate
                  ? `بتاريخ ${asOfDate.toLocaleDateString("ar-KW")}`
                  : `للسنة المالية ${fiscalYear.year}`}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Assets */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 font-bold text-blue-800 text-sm border-b">الأصول</div>
                <table className="ar-table text-xs">
                  <tbody>
                    {report.assets.map((row) => (
                      <tr key={row.accountId} className={row.isHeader ? "bg-muted/20" : "hover:bg-muted/10"}>
                        <td className="font-mono text-muted-foreground w-20">{row.code}</td>
                        <td className={row.isHeader ? "font-bold" : ""}>{row.nameAr}</td>
                        <td className="text-left number text-blue-600 w-28">
                          {row.isHeader ? "" : row.amount.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold border-t-2">
                      <td colSpan={2} className="text-blue-800 py-2">إجمالي الأصول</td>
                      <td className="text-left number text-blue-700">{report.totalAssets.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Liabilities + Equity */}
              <div className="space-y-4">
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="bg-orange-50 px-4 py-2 font-bold text-orange-800 text-sm border-b">الالتزامات</div>
                  <table className="ar-table text-xs">
                    <tbody>
                      {report.liabilities.map((row) => (
                        <tr key={row.accountId} className={row.isHeader ? "bg-muted/20" : "hover:bg-muted/10"}>
                          <td className="font-mono text-muted-foreground w-20">{row.code}</td>
                          <td className={row.isHeader ? "font-bold" : ""}>{row.nameAr}</td>
                          <td className="text-left number text-orange-600 w-28">
                            {row.isHeader ? "" : row.amount.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-orange-50 font-bold border-t-2">
                        <td colSpan={2} className="text-orange-800 py-2">إجمالي الالتزامات</td>
                        <td className="text-left number text-orange-700">{report.totalLiabilities.toFixed(3)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 px-4 py-2 font-bold text-emerald-800 text-sm border-b">حقوق الملكية</div>
                  <table className="ar-table text-xs">
                    <tbody>
                      {report.equity.map((row) => (
                        <tr key={row.accountId} className={row.isHeader ? "bg-muted/20" : "hover:bg-muted/10"}>
                          <td className="font-mono text-muted-foreground w-20">{row.code}</td>
                          <td className={row.isHeader ? "font-bold" : ""}>{row.nameAr}</td>
                          <td className="text-left number text-emerald-600 w-28">
                            {row.isHeader ? "" : row.amount.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                      {/* Net Income line */}
                      <tr className="hover:bg-muted/10">
                        <td className="font-mono text-muted-foreground w-20">—</td>
                        <td>{report.netIncome >= 0 ? "صافي الربح للفترة" : "صافي خسارة الفترة"}</td>
                        <td className={`text-left number w-28 ${report.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {report.netIncome.toFixed(3)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold border-t-2">
                        <td colSpan={2} className="text-emerald-800 py-2">إجمالي حقوق الملكية</td>
                        <td className="text-left number text-emerald-700">
                          {(report.totalEquity + report.netIncome).toFixed(3)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
