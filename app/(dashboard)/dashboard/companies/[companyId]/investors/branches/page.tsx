import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function InvestorBranchesPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const branches = await prisma.branch.findMany({
    where: { companyId, isActive: true },
    include: {
      investorBranches: {
        where: { isActive: true },
        include: {
          investor: { select: { nameAr: true, nameEn: true, phone: true } },
        },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  return (
    <div>
      <Header
        title={locale === "en" ? "Branches & Investors" : "الفروع والمسئولون والمديرون"}
        subtitle={locale === "en" ? "Branch ownership distribution across investors" : "توزيع ملكية الفروع على المسئولين والمديرين"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/investors/branches/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New branch" : "فرع جديد"}
          </Link>
        }
      />

      <div className="page-container">
        {branches.length === 0 ? (
          <div className="section-card py-12 text-center text-muted-foreground">
            {locale === "en" ? "No branches have been added for this company yet" : "لا توجد فروع مضافة لهذه الشركة بعد"}
          </div>
        ) : (
          <div className="space-y-4">
            {branches.map((branch) => (
              <div key={branch.id} className="section-card">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold">{locale === "en" ? branch.nameEn ?? branch.nameAr : branch.nameAr}</h3>
                    {branch.address && <p className="mt-0.5 text-xs text-muted-foreground">{branch.address}</p>}
                  </div>
                  <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    {branch.investorBranches.length} {locale === "en" ? "investor(s)" : "مسئول"}
                  </span>
                </div>

                {branch.investorBranches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {locale === "en" ? "No investors are linked to this branch" : "لا يوجد مسئولون ومديرون مرتبطون بهذا الفرع"}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="ar-table">
                      <thead>
                        <tr>
                          <th>{locale === "en" ? "Investor" : "المسئول والمدير"}</th>
                          <th>{locale === "en" ? "Ownership %" : "نسبة الملكية"}</th>
                          <th>{locale === "en" ? "Start date" : "تاريخ البداية"}</th>
                          <th>{locale === "en" ? "Phone" : "الهاتف"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branch.investorBranches.map((relation) => (
                          <tr key={relation.id} className="hover:bg-muted/30">
                            <td className="font-medium">
                              {locale === "en" ? relation.investor.nameEn ?? relation.investor.nameAr : relation.investor.nameAr}
                            </td>
                            <td className="text-center font-bold number text-blue-600">{Number(relation.ownershipPct).toFixed(1)}%</td>
                            <td className="text-sm">{formatDate(relation.startDate, dateLocale)}</td>
                            <td className="text-sm text-muted-foreground" dir="ltr">
                              {relation.investor.phone ?? (locale === "en" ? "Not set" : "غير محدد")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
