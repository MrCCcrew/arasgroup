import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getIncomeStatement } from "@/lib/accounting/reports";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { TrendingUp, TrendingDown, FileDown } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/ui/print-button";
import { ExcelDownloadButton } from "@/components/ui/excel-download-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; startDate?: string; endDate?: string }>;
}

export default async function IncomeStatementPage({ params, searchParams }: Props) {
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

  const startDate = sp.startDate ? new Date(sp.startDate) : undefined;
  const endDate = sp.endDate ? new Date(sp.endDate) : undefined;

  const report = fiscalYear
    ? await getIncomeStatement(companyId, fiscalYear.id, startDate, endDate)
    : null;

  const isProfit = (report?.netIncome ?? 0) >= 0;

  const en = (await getLocale()) === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    title: en ? "Income Statement" : "قائمة الدخل",
    fiscalYear: en ? "Fiscal year" : "السنة المالية",
    current: en ? "(current)" : "(الحالية)",
    from: en ? "From date" : "من تاريخ",
    to: en ? "To date" : "إلى تاريخ",
    show: en ? "Show" : "عرض",
    noFiscalYear: en ? "No fiscal year. Please create a fiscal year first." : "لا توجد سنة مالية. يرجى إنشاء سنة مالية أولاً.",
    totalRevenue: en ? "Total revenue" : "إجمالي الإيرادات",
    totalExpenses: en ? "Total expenses" : "إجمالي المصروفات",
    netProfit: en ? "Net profit" : "صافي الربح",
    netLoss: en ? "Net loss" : "صافي الخسارة",
    reportName: en ? "Income Statement (Profit & Loss)" : "قائمة الدخل (الأرباح والخسائر)",
    forYear: en ? "For fiscal year" : "للسنة المالية",
    toWord: en ? "to" : "إلى",
    revenues: en ? "Revenues" : "الإيرادات",
    expenses: en ? "Expenses" : "المصروفات",
    noRevenues: en ? "No revenues" : "لا توجد إيرادات",
    noExpenses: en ? "No expenses" : "لا توجد مصروفات",
    kwd: en ? "KWD" : "د.ك",
  };

  return (
    <div>
      <Header
        title={t.title}
        subtitle={`${company?.nameAr} — ${fiscalYear?.year ?? "—"}`}
        companyId={companyId}
        actions={
          <div className="flex gap-2">
            <PrintButton />
            {fiscalYear && (
              <Link
                href={`/dashboard/companies/${companyId}/accounting/reports/income-statement/print?fiscalYearId=${fiscalYear.id}${sp.startDate ? `&startDate=${sp.startDate}` : ""}${sp.endDate ? `&endDate=${sp.endDate}` : ""}`}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                <FileDown size={16} /> PDF
              </Link>
            )}
            {fiscalYear && (
              <ExcelDownloadButton
                url={`/api/reports/export?format=excel&type=income_statement&companyId=${companyId}&fiscalYearId=${fiscalYear.id}`}
                filename={`income-statement-${fiscalYear.year}.xlsx`}
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
              <label className="block text-sm font-medium mb-1.5">{t.fiscalYear}</label>
              <select
                name="fiscalYearId"
                defaultValue={fiscalYear?.id ?? ""}
                className="input-field"
              >
                {allFiscalYears.map((fy: typeof allFiscalYears[number]) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.year} {fy.isCurrent ? t.current : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t.from}</label>
              <input
                type="date"
                name="startDate"
                defaultValue={sp.startDate ?? ""}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t.to}</label>
              <input
                type="date"
                name="endDate"
                defaultValue={sp.endDate ?? ""}
                className="input-field"
              />
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              {t.show}
            </button>
          </div>
        </form>

        {!fiscalYear ? (
          <div className="text-center py-12 text-muted-foreground">
            {t.noFiscalYear}
          </div>
        ) : !report ? null : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="stat-card">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp size={18} />
                  <span className="text-sm font-medium">{t.totalRevenue}</span>
                </div>
                <div className="text-2xl font-bold text-green-600 number">
                  {formatKWD(report.totalRevenue, numberLocale)}
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown size={18} />
                  <span className="text-sm font-medium">{t.totalExpenses}</span>
                </div>
                <div className="text-2xl font-bold text-red-600 number">
                  {formatKWD(report.totalExpenses, numberLocale)}
                </div>
              </div>
              <div className="stat-card">
                <div className={`flex items-center gap-2 ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                  {isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  <span className="text-sm font-medium">{isProfit ? t.netProfit : t.netLoss}</span>
                </div>
                <div className={`text-2xl font-bold number ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                  {formatKWD(Math.abs(report.netIncome), numberLocale)}
                </div>
              </div>
            </div>

            {/* Report Header */}
            <div className="section-card text-center space-y-1">
              <h2 className="text-xl font-bold">{company?.nameAr}</h2>
              <p className="text-muted-foreground font-medium">{t.reportName}</p>
              <p className="text-sm">{t.forYear} {fiscalYear.year}</p>
              {(startDate || endDate) && (
                <p className="text-xs text-muted-foreground">
                  {startDate?.toLocaleDateString(numberLocale) ?? "—"} {t.toWord} {endDate?.toLocaleDateString(numberLocale) ?? "—"}
                </p>
              )}
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              {/* Revenues */}
              <div className="border-b">
                <div className="bg-green-50 px-4 py-2 font-bold text-green-800 text-sm">{t.revenues}</div>
                <table className="ar-table">
                  <tbody>
                    {report.revenues.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center text-muted-foreground py-4">{t.noRevenues}</td>
                      </tr>
                    ) : (
                      report.revenues.map((row: typeof report.revenues[number]) => (
                        <tr
                          key={row.accountId}
                          className={row.isHeader ? "bg-muted/20" : "hover:bg-muted/10"}
                        >
                          <td className={`font-mono text-xs text-muted-foreground w-28 ${row.isHeader ? "font-bold" : ""}`}>
                            {row.code}
                          </td>
                          <td className={`${row.isHeader ? "font-bold" : ""}`}>{row.nameAr}</td>
                          <td className="text-left number text-green-600 font-medium w-36">
                            {row.isHeader ? "" : row.amount.toFixed(3)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-green-50 font-bold border-t-2">
                      <td colSpan={2} className="text-green-800">{t.totalRevenue}</td>
                      <td className="text-left number text-green-700 text-base">{report.totalRevenue.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expenses */}
              <div className="border-b">
                <div className="bg-red-50 px-4 py-2 font-bold text-red-800 text-sm">{t.expenses}</div>
                <table className="ar-table">
                  <tbody>
                    {report.expenses.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center text-muted-foreground py-4">{t.noExpenses}</td>
                      </tr>
                    ) : (
                      report.expenses.map((row: typeof report.expenses[number]) => (
                        <tr
                          key={row.accountId}
                          className={row.isHeader ? "bg-muted/20" : "hover:bg-muted/10"}
                        >
                          <td className={`font-mono text-xs text-muted-foreground w-28 ${row.isHeader ? "font-bold" : ""}`}>
                            {row.code}
                          </td>
                          <td className={`${row.isHeader ? "font-bold" : ""}`}>{row.nameAr}</td>
                          <td className="text-left number text-red-600 font-medium w-36">
                            {row.isHeader ? "" : row.amount.toFixed(3)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-red-50 font-bold border-t-2">
                      <td colSpan={2} className="text-red-800">{t.totalExpenses}</td>
                      <td className="text-left number text-red-700 text-base">{report.totalExpenses.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Income */}
              <div className={`px-4 py-4 flex items-center justify-between font-bold text-lg ${isProfit ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                <span>{isProfit ? t.netProfit : t.netLoss}</span>
                <span className="number text-xl">{Math.abs(report.netIncome).toFixed(3)} {t.kwd}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
