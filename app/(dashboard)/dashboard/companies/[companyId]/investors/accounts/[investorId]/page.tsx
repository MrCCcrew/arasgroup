import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { InvestorAccountsManager } from "@/components/investors/investor-accounts-manager";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ companyId: string; investorId: string }>;
}

export default async function InvestorAccountDetailPage({ params }: Props) {
  const { companyId, investorId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const canView = session.isSuperAdmin
    || hasPermission(session, "INVESTORS", "VIEW", { companyId })
    || hasPermission(session, "INVESTOR_CLAIMS", "VIEW", { companyId });
  if (!canView) notFound();

  const [investor, branches, licenses, employees, agreements, salaryProfiles, claims, salaryCollections] = await Promise.all([
    prisma.investor.findFirst({
      where: { id: investorId, isActive: true },
      select: { id: true, nameAr: true, phone: true, companies: { select: { id: true } } },
    }),
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.license.findMany({
      where: { companyId, investorId },
      select: { id: true, commercialNameAr: true, commercialNameEn: true, licenseNumber: true },
      orderBy: { commercialNameAr: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId, investorId, isActive: true, isDeleted: false },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.investorAccountAgreement.findMany({
      where: { companyId, investorId },
      include: {
        branch: { select: { id: true, nameAr: true, nameEn: true } },
        license: { select: { id: true, commercialNameAr: true, commercialNameEn: true, licenseNumber: true } },
        employee: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.investorSalaryFundingProfile.findMany({
      where: { companyId, investorId },
      include: {
        branch: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.investorClaim.findMany({
      where: { companyId, investorId },
      include: { lines: true },
      orderBy: { claimDate: "desc" },
    }),
    prisma.investorSalaryCollection.findMany({
      where: { companyId, investorId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!investor || !investor.companies.some((item) => item.id === companyId)) notFound();

  return (
    <div>
      <Header
        title={`حساب ${investor.nameAr}`}
        subtitle="إدارة الاتفاقيات المالية وتمويل الرواتب وربطها بالمطالبات"
        companyId={companyId}
      />

      <div className="page-container">
        <InvestorAccountsManager
          companyId={companyId}
          investorId={investorId}
          investorName={investor.nameAr}
          investorPhone={investor.phone}
          branches={branches}
          licenses={licenses.map((item) => ({ id: item.id, nameAr: item.commercialNameAr, nameEn: item.commercialNameEn, licenseNumber: item.licenseNumber }))}
          employees={employees}
          agreements={agreements.map((item) => ({
            ...item,
            amount: item.amount.toString(),
            license: item.license
              ? {
                  id: item.license.id,
                  nameAr: item.license.commercialNameAr,
                  nameEn: item.license.commercialNameEn,
                  licenseNumber: item.license.licenseNumber,
                }
              : null,
          }))}
          salaryProfiles={salaryProfiles.map((item) => ({
            ...item,
            monthlyAmount: item.monthlyAmount.toString(),
          }))}
          claims={claims.map((item) => ({
            ...item,
            lines: item.lines.map((line) => ({
              actualAmount: line.actualAmount.toString(),
              collectedAmount: line.collectedAmount.toString(),
            })),
          }))}
          salaryCollections={salaryCollections.map((item) => ({
            ...item,
            collectedAmount: item.collectedAmount.toString(),
          }))}
        />
      </div>
    </div>
  );
}
