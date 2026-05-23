import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function InvestorStatementsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const investors = await prisma.investor.findMany({
    where: {
      OR: [{ companies: { some: { id: companyId } } }, { claims: { some: { companyId } } }],
    },
    include: {
      claims: {
        where: { companyId },
        include: { lines: true, payments: true },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  return (
    <div>
      <Header
        title={locale === "en" ? "Investor Statements" : "كشوف المستثمرين"}
        subtitle={locale === "en" ? "Summary of claims, collections, and payments" : "ملخص المطالبات والتحصيل والمدفوعات"}
        companyId={companyId}
      />
      <div className="page-container">
        <div className="section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Investor" : "المستثمر"}</th>
                  <th>{locale === "en" ? "Claims count" : "عدد المطالبات"}</th>
                  <th>{locale === "en" ? "Collected total" : "إجمالي التحصيل"}</th>
                  <th>{locale === "en" ? "Actual total" : "إجمالي الفعلي"}</th>
                  <th>{locale === "en" ? "Paid total" : "إجمالي المدفوع"}</th>
                  <th>{locale === "en" ? "Balance" : "الرصيد"}</th>
                </tr>
              </thead>
              <tbody>
                {investors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {locale === "en" ? "No investor statement data found" : "لا توجد بيانات مستثمرين"}
                    </td>
                  </tr>
                ) : (
                  investors.map((investor) => {
                    const totalCollected = investor.claims.reduce(
                      (sum, claim) => sum + claim.lines.reduce((lineSum, line) => lineSum + Number(line.collectedAmount), 0),
                      0,
                    );
                    const totalActual = investor.claims.reduce(
                      (sum, claim) => sum + claim.lines.reduce((lineSum, line) => lineSum + Number(line.actualAmount), 0),
                      0,
                    );
                    const totalPaid = investor.claims.reduce(
                      (sum, claim) => sum + claim.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
                      0,
                    );
                    const balance = totalCollected - totalPaid;
                    const investorName = locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr;
                    return (
                      <tr key={investor.id}>
                        <td className="font-medium">{investorName}</td>
                        <td>{investor.claims.length}</td>
                        <td className="number">{formatKWD(totalCollected, numberLocale)}</td>
                        <td className="number">{formatKWD(totalActual, numberLocale)}</td>
                        <td className="number">{formatKWD(totalPaid, numberLocale)}</td>
                        <td className={`number ${balance > 0 ? "text-red-700" : "text-green-700"}`}>
                          {formatKWD(balance, numberLocale)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
