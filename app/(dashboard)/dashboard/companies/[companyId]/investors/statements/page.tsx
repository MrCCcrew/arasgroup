import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { StatementsPrintBar } from "./StatementsPrintBar";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function InvestorStatementsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  // ← fix 1: exclude deleted/inactive investors
  const investors = await prisma.investor.findMany({
    where: {
      isActive: true,
      OR: [
        { companies: { some: { id: companyId } } },
        { claims: { some: { companyId } } },
      ],
    },
    include: {
      claims: {
        where: { companyId },
        include: { lines: true, payments: true },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  type InvestorRow = typeof investors[number];
  type ClaimRow = InvestorRow["claims"][number];
  type ClaimLineRow = ClaimRow["lines"][number];
  type PaymentRow = ClaimRow["payments"][number];

  // Build row data server-side (needed for print totals)
  const rows = investors.map((investor: InvestorRow) => {
    const totalCollected = investor.claims.reduce(
      (sum: number, c: ClaimRow) => sum + c.lines.reduce((s: number, l: ClaimLineRow) => s + Number(l.collectedAmount), 0),
      0,
    );
    const totalActual = investor.claims.reduce(
      (sum: number, c: ClaimRow) => sum + c.lines.reduce((s: number, l: ClaimLineRow) => s + Number(l.actualAmount), 0),
      0,
    );
    const totalPaid = investor.claims.reduce(
      (sum: number, c: ClaimRow) => sum + c.payments.reduce((s: number, p: PaymentRow) => s + Number(p.amount), 0),
      0,
    );
    const balance = totalCollected - totalPaid;
    return {
      id: investor.id,
      name: locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr,
      claimsCount: investor.claims.length,
      totalCollected,
      totalActual,
      totalPaid,
      balance,
    };
  });

  // Grand totals
  type StatementRow = typeof rows[number];
  const grand = rows.reduce(
    (acc: { claimsCount: number; totalCollected: number; totalActual: number; totalPaid: number; balance: number }, r: StatementRow) => ({
      claimsCount:    acc.claimsCount    + r.claimsCount,
      totalCollected: acc.totalCollected + r.totalCollected,
      totalActual:    acc.totalActual    + r.totalActual,
      totalPaid:      acc.totalPaid      + r.totalPaid,
      balance:        acc.balance        + r.balance,
    }),
    { claimsCount: 0, totalCollected: 0, totalActual: 0, totalPaid: 0, balance: 0 },
  );

  const col = locale === "en";

  return (
    <div>
      <Header
        title={col ? "Investor Statements" : "كشوف المسئولين والمديرين"}
        subtitle={col ? "Summary of claims, collections, and payments" : "ملخص المطالبات والتحصيل والمدفوعات"}
        companyId={companyId}
        actions={<StatementsPrintBar />}
      />

      {/* Print-only heading */}
      <div className="print-only px-6 py-4 border-b">
        <h1 className="text-xl font-bold">{col ? "Investor Statements" : "كشوف المسئولين والمديرين"}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {col ? "Printed on" : "تاريخ الطباعة"}: {new Date().toLocaleDateString(numberLocale)}
        </p>
      </div>

      <div className="page-container">
        <div className="section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{col ? "Investor" : "المسئول والمدير"}</th>
                  {/* ← fix 2: number headers right-aligned to match data cells */}
                  <th className="text-right">{col ? "Claims" : "عدد المطالبات"}</th>
                  <th className="text-right">{col ? "Collected total" : "إجمالي التحصيل"}</th>
                  <th className="text-right">{col ? "Actual total" : "إجمالي الفعلي"}</th>
                  <th className="text-right">{col ? "Paid total" : "إجمالي المدفوع"}</th>
                  <th className="text-right">{col ? "Balance" : "الرصيد"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {col ? "No investor data found" : "لا توجد بيانات مسئولين ومديرين"}
                    </td>
                  </tr>
                ) : (
                  rows.map((r: StatementRow) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.name}</td>
                      <td className="number">{r.claimsCount}</td>
                      <td className="number">{formatKWD(r.totalCollected, numberLocale)}</td>
                      <td className="number">{formatKWD(r.totalActual,    numberLocale)}</td>
                      <td className="number">{formatKWD(r.totalPaid,      numberLocale)}</td>
                      <td className={`number font-semibold ${r.balance > 0 ? "text-red-600" : r.balance < 0 ? "text-green-600" : ""}`}>
                        {formatKWD(r.balance, numberLocale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Totals row */}
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td>{col ? "Total" : "الإجمالي"}</td>
                    <td className="number">{grand.claimsCount}</td>
                    <td className="number">{formatKWD(grand.totalCollected, numberLocale)}</td>
                    <td className="number">{formatKWD(grand.totalActual,    numberLocale)}</td>
                    <td className="number">{formatKWD(grand.totalPaid,      numberLocale)}</td>
                    <td className={`number ${grand.balance > 0 ? "text-red-600" : grand.balance < 0 ? "text-green-600" : ""}`}>
                      {formatKWD(grand.balance, numberLocale)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
