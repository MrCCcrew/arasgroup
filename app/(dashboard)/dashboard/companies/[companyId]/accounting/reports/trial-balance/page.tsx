import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { formatKWD } from "@/lib/utils";
import { Download, FileDown } from "lucide-react";
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

  const totalOpeningDebit = rows.reduce((s, r) => s + r.openingDebit, 0);
  const totalOpeningCredit = rows.reduce((s, r) => s + r.openingCredit, 0);
  const totalPeriodDebit = rows.reduce((s, r) => s + r.periodDebit, 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + r.periodCredit, 0);
  const totalClosingDebit = rows.reduce((s, r) => s + r.closingDebit, 0);
  const totalClosingCredit = rows.reduce((s, r) => s + r.closingCredit, 0);

  return (
    <div>
      <Header
        title="ميزان المراجعة"
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
          <p className="text-muted-foreground">ميزان المراجعة</p>
          <p className="text-sm">للسنة المالية {fiscalYear?.year}</p>
          <p className="text-xs text-muted-foreground">
            {fiscalYear?.startDate?.toLocaleDateString("ar-KW")} إلى {fiscalYear?.endDate?.toLocaleDateString("ar-KW")}
          </p>
        </div>

        {!fiscalYear ? (
          <div className="text-center py-12 text-muted-foreground">
            لا توجد سنة مالية محددة. يرجى إنشاء سنة مالية أولاً.
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ar-table text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-24">كود الحساب</th>
                    <th>اسم الحساب</th>
                    <th className="text-center" colSpan={2}>الأرصدة الافتتاحية</th>
                    <th className="text-center" colSpan={2}>حركة الفترة</th>
                    <th className="text-center" colSpan={2}>الأرصدة الختامية</th>
                  </tr>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th></th>
                    <th></th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>مدين</th>
                    <th>دائن</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
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
                    <td colSpan={2} className="text-center py-2">الإجمالي</td>
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
                        ? "✓ الميزان متوازن"
                        : `✗ فرق الميزان: ${Math.abs(totalClosingDebit - totalClosingCredit).toFixed(3)}`}
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
