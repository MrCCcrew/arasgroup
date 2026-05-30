import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { formatKWD, toNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function InvestorAccountsPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const canView = session.isSuperAdmin
    || hasPermission(session, "INVESTORS", "VIEW", { companyId })
    || hasPermission(session, "INVESTOR_CLAIMS", "VIEW", { companyId });
  if (!canView) notFound();

  const investors = await prisma.investor.findMany({
    where: {
      isActive: true,
      companies: { some: { id: companyId } },
    },
    include: {
      accountAgreements: { where: { companyId } },
      salaryFundingProfiles: { where: { companyId } },
      claims: {
        where: { companyId },
        include: { lines: true },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  const totalOutstanding = investors.reduce((sum, investor) => {
    const actual = investor.claims.reduce((claimSum, claim) => claimSum + claim.lines.reduce((lineSum, line) => lineSum + toNumber(line.actualAmount), 0), 0);
    const collected = investor.claims.reduce((claimSum, claim) => claimSum + claim.lines.reduce((lineSum, line) => lineSum + toNumber(line.collectedAmount), 0), 0);
    return sum + (actual - collected);
  }, 0);

  return (
    <div>
      <Header
        title="حسابات المسئولين والمديرين"
        subtitle="الاتفاقيات المالية وتمويل الرواتب والمطالبات المرتبطة بها"
        companyId={companyId}
      />

      <div className="page-container space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="عدد المسئولين" value={String(investors.length)} />
          <StatCard label="الاتفاقيات النشطة" value={String(investors.reduce((sum, investor) => sum + investor.accountAgreements.filter((item) => item.isActive).length, 0))} />
          <StatCard label="ملفات تمويل الرواتب" value={String(investors.reduce((sum, investor) => sum + investor.salaryFundingProfiles.filter((item) => item.isActive).length, 0))} />
          <StatCard label="إجمالي المتبقي" value={formatKWD(totalOutstanding)} />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>المسئول / المدير</th>
                  <th>الاتفاقيات</th>
                  <th>ملفات الرواتب</th>
                  <th>المطالبات</th>
                  <th>المتبقي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {investors.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا يوجد مسئولون مرتبطون بهذه الشركة</td></tr>
                ) : investors.map((investor) => {
                  const actual = investor.claims.reduce((claimSum, claim) => claimSum + claim.lines.reduce((lineSum, line) => lineSum + toNumber(line.actualAmount), 0), 0);
                  const collected = investor.claims.reduce((claimSum, claim) => claimSum + claim.lines.reduce((lineSum, line) => lineSum + toNumber(line.collectedAmount), 0), 0);
                  return (
                    <tr key={investor.id}>
                      <td>
                        <div className="font-medium">{investor.nameAr}</div>
                        {investor.phone && <div className="text-xs text-muted-foreground">{investor.phone}</div>}
                      </td>
                      <td>{investor.accountAgreements.length}</td>
                      <td>{investor.salaryFundingProfiles.length}</td>
                      <td>{investor.claims.length}</td>
                      <td className="number">{formatKWD(actual - collected)}</td>
                      <td>
                        <Link href={`/dashboard/companies/${companyId}/investors/accounts/${investor.id}`} className="text-sm text-primary hover:underline">
                          فتح الحساب
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
