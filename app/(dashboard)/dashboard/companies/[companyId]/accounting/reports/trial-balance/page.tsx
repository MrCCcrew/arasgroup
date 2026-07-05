import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { getLocale } from "@/lib/i18n";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "@/components/ui/print-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string }>;
}

export default async function TrialBalancePage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const en = (await getLocale()) === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    title: en ? "Trial Balance" : "ميزان المراجعة",
    forYear: en ? "For fiscal year" : "للسنة المالية",
    to: en ? "to" : "إلى",
    noFiscalYear: en ? "No fiscal year set. Please create a fiscal year first." : "لا توجد سنة مالية محددة. يرجى إنشاء سنة مالية أولاً.",
    accountCode: en ? "Account code" : "كود الحساب",
    accountName: en ? "Account name" : "اسم الحساب",
    opening: en ? "Opening balances" : "الأرصدة الافتتاحية",
    period: en ? "Period movement" : "حركة الفترة",
    closing: en ? "Closing balances" : "الأرصدة الختامية",
    debit: en ? "Debit" : "مدين",
    credit: en ? "Credit" : "دائن",
    total: en ? "Total" : "الإجمالي",
    balanced: en ? "✓ The trial balance is balanced" : "✓ الميزان متوازن",
    diff: (d: string) => (en ? `✗ Balance difference: ${d}` : `✗ فرق الميزان: ${d}`),
  };

  // Get current fiscal year
  const fiscalYear = sp.fiscalYearId
    ? await prisma.fiscalYear.findUnique({ where: { id: sp.fiscalYearId } })
    : await prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true } });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true },
  });

  const rows = fiscalYear
    ? await getTrialBalance(companyId, fiscalYear.id)
    : [];
  type TrialBalanceRow = typeof rows[number];

  const totalOpeningDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.openingDebit, 0);
  const totalOpeningCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.openingCredit, 0);
  const totalPeriodDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.periodDebit, 0);
  const totalPeriodCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.periodCredit, 0);
  const totalClosingDebit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.closingDebit, 0);
  const totalClosingCredit = rows.reduce((s: number, r: TrialBalanceRow) => s + r.closingCredit, 0);

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
                href={`/dashboard/companies/${companyId}/accounting/reports/trial-balance/print?fiscalYearId=${fiscalYear.id}`}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                <FileDown size={16} /> PDF
              </Link>
            )}
          </div>
        }
      />

      <div className="page-container">
        {/* Report Header */}
        <div className="section-card text-center space-y-1">
          <h2 className="text-xl font-bold">{company?.nameAr}</h2>
          <p className="text-muted-foreground">{t.title}</p>
          <p className="text-sm">{t.forYear} {fiscalYear?.year}</p>
          <p className="text-xs text-muted-foreground">
            {fiscalYear?.startDate?.toLocaleDateString(numberLocale)} {t.to} {fiscalYear?.endDate?.toLocaleDateString(numberLocale)}
          </p>
        </div>

        {!fiscalYear ? (
          <div className="text-center py-12 text-muted-foreground">
            {t.noFiscalYear}
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ar-table text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-24">{t.accountCode}</th>
                    <th>{t.accountName}</th>
                    <th className="text-center" colSpan={2}>{t.opening}</th>
                    <th className="text-center" colSpan={2}>{t.period}</th>
                    <th className="text-center" colSpan={2}>{t.closing}</th>
                  </tr>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th></th>
                    <th></th>
                    <th>{t.debit}</th>
                    <th>{t.credit}</th>
                    <th>{t.debit}</th>
                    <th>{t.credit}</th>
                    <th>{t.debit}</th>
                    <th>{t.credit}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: TrialBalanceRow) => (
                    <tr
                      key={row.accountId}
                      className={`${row.isHeader ? "bg-muted/20 font-bold" : "hover:bg-muted/10"}`}
                    >
                      <td className="font-mono">{row.code}</td>
                      <td className={`${row.isHeader ? "font-bold" : ""} ${row.level > 1 ? `pr-${row.level * 2}` : ""}`}>
                        {row.nameAr}
                      </td>
                      <td className="number text-left">{row.openingDebit > 0 ? row.openingDebit.toFixed(3) : "—"}</td>
                      <td className="number text-left">{row.openingCredit > 0 ? row.openingCredit.toFixed(3) : "—"}</td>
                      <td className="number text-left text-blue-600">{row.periodDebit > 0 ? row.periodDebit.toFixed(3) : "—"}</td>
                      <td className="number text-left text-green-600">{row.periodCredit > 0 ? row.periodCredit.toFixed(3) : "—"}</td>
                      <td className="number text-left font-bold">{row.closingDebit > 0 ? row.closingDebit.toFixed(3) : "—"}</td>
                      <td className="number text-left font-bold">{row.closingCredit > 0 ? row.closingCredit.toFixed(3) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border font-bold bg-muted/30">
                  <tr>
                    <td colSpan={2} className="text-center py-2">{t.total}</td>
                    <td className="number text-left">{totalOpeningDebit.toFixed(3)}</td>
                    <td className="number text-left">{totalOpeningCredit.toFixed(3)}</td>
                    <td className="number text-left text-blue-600">{totalPeriodDebit.toFixed(3)}</td>
                    <td className="number text-left text-green-600">{totalPeriodCredit.toFixed(3)}</td>
                    <td className="number text-left">{totalClosingDebit.toFixed(3)}</td>
                    <td className="number text-left">{totalClosingCredit.toFixed(3)}</td>
                  </tr>
                  {/* Balance check */}
                  <tr className={`text-xs ${Math.abs(totalClosingDebit - totalClosingCredit) < 0.001 ? "text-green-600" : "text-red-600"}`}>
                    <td colSpan={8} className="text-center py-1">
                      {Math.abs(totalClosingDebit - totalClosingCredit) < 0.001
                        ? t.balanced
                        : t.diff(Math.abs(totalClosingDebit - totalClosingCredit).toFixed(3))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
