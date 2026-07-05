import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ q?: string; licenseType?: string }>;
}

export default async function InvestorsPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const searchQuery = resolvedSearchParams.q?.trim() ?? "";
  const licenseType = resolvedSearchParams.licenseType === "main" || resolvedSearchParams.licenseType === "sub"
    ? resolvedSearchParams.licenseType
    : "all";

  // Query investors directly via the company relation (created via POST with companies.connect)
  // This ensures investors without branch links are also visible in the list.
  const investors = await prisma.investor.findMany({
    where: {
      isActive: true,
      companies: { some: { id: companyId } },
      ...(searchQuery
        ? {
            OR: [
              { nameAr: { contains: searchQuery } },
              { nameEn: { contains: searchQuery } },
              { phone: { contains: searchQuery } },
              { phone2: { contains: searchQuery } },
            ],
          }
        : {}),
      ...(licenseType === "all"
        ? {}
        : {
            licenses: {
              some: {
                companyId,
                isMainLicense: licenseType === "main",
              },
            },
          }),
    },
    include: {
      _count: { select: { claims: true } },
      investorBranches: {
        where: { isActive: true },
        include: { branch: { select: { nameAr: true, nameEn: true } } },
      },
    },
    orderBy: { nameAr: "asc" },
  });

  const openClaims = await prisma.investorClaim.groupBy({
    by: ["investorId"],
    where: {
      companyId,
      status: { in: ["PENDING", "SENT_TO_ACCOUNTANT", "SENT_TO_INVESTOR", "PARTIALLY_COLLECTED", "OVERDUE"] },
    },
    _count: { id: true },
  });

  type InvestorRow = typeof investors[number];
  type OpenClaimGroupRow = typeof openClaims[number];

  const openClaimsMap = new Map<string, number>(openClaims.map((item: OpenClaimGroupRow) => [item.investorId, item._count.id]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyCollections = await prisma.investorPayment.groupBy({
    by: ["investorId"],
    where: {
      claim: { companyId },
      paymentDate: { gte: monthStart },
    },
    _sum: { amount: true },
  });

  type MonthlyCollectionRow = typeof monthlyCollections[number];

  const collectionsMap = new Map<string, number>(monthlyCollections.map((item: MonthlyCollectionRow) => [item.investorId, Number(item._sum.amount ?? 0)]));

  // investors is already a deduplicated, sorted array from the query above

  return (
    <div>
      <Header
        title={locale === "en" ? "Investors" : "المسئولون والمديرون"}
        subtitle={`${investors.length} ${locale === "en" ? "active investor(s)" : "مسئول نشط"}`}
        companyId={companyId}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/dashboard/companies/${companyId}/investors/new`}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus size={16} />
              {locale === "en" ? "New investor" : "مسئول جديد"}
            </Link>
            <Link
              href={`/dashboard/companies/${companyId}/investors/claims/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New claim" : "مطالبة جديدة"}
            </Link>
          </div>
        }
      />

      <div className="page-container space-y-8">
        <form className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={searchQuery}
            className="input-field w-full"
            placeholder={locale === "en" ? "Search by name or phone..." : "ابحث بالاسم أو رقم التليفون..."}
          />
          <select name="licenseType" defaultValue={licenseType} className="input-field w-full">
            <option value="all">{locale === "en" ? "All licenses" : "كل التراخيص"}</option>
            <option value="main">{locale === "en" ? "Main license" : "ترخيص رئيسي"}</option>
            <option value="sub">{locale === "en" ? "Sub-license" : "ترخيص فرعي"}</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              {locale === "en" ? "Search" : "بحث"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/investors`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {locale === "en" ? "Reset" : "إلغاء"}
            </Link>
          </div>
        </form>

        {investors.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>{locale === "en" ? "No investors are linked to this company yet" : "لا يوجد مسئولون ومديرون مرتبطون بهذه الشركة بعد"}</p>
            <p className="mt-2 text-sm">{locale === "en" ? "Create branches and link them to investors first" : "أنشئ الفروع واربطها بالمسئولين أولاً"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {investors.map((investor: InvestorRow) => {
              const openCount = openClaimsMap.get(investor.id) ?? 0;
              const monthlyCollected = collectionsMap.get(investor.id) ?? 0;
              const investorName = locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr;

              return (
                <Link
                  key={investor.id}
                  href={`/dashboard/companies/${companyId}/investors/${investor.id}`}
                  className="group block"
                >
                  <div className="rounded-xl border bg-card p-5 transition-all group-hover:border-primary/30 group-hover:shadow-md">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">{investorName}</h3>
                        {investor.phone && (
                          <p className="number text-xs text-muted-foreground" dir="ltr">
                            {investor.phone}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                        {locale === "en" ? "Active" : "نشط"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-lg font-bold text-orange-600">{openCount}</p>
                        <p className="text-xs text-muted-foreground">{locale === "en" ? "Open claims" : "مطالبات مفتوحة"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2 text-center">
                        <p className="text-lg font-bold text-green-600 number">{formatKWD(monthlyCollected, numberLocale)}</p>
                        <p className="text-xs text-muted-foreground">{locale === "en" ? "Collected this month" : "تحصيل هذا الشهر"}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {investor._count.claims} {locale === "en" ? "total claim(s)" : "مطالبة إجمالية"}
                      </span>
                      <span className="font-medium text-primary group-hover:underline">
                        {locale === "en" ? "View details" : "عرض التفاصيل"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">{locale === "en" ? "Recent claims" : "المطالبات الحديثة"}</h2>
            <Link href={`/dashboard/companies/${companyId}/investors/claims`} className="text-xs text-primary hover:underline">
              {locale === "en" ? "View all" : "عرض الكل"}
            </Link>
          </div>

          <RecentClaims companyId={companyId} locale={locale} numberLocale={numberLocale} />
        </div>
      </div>
    </div>
  );
}

async function RecentClaims({
  companyId,
  locale,
  numberLocale,
}: {
  companyId: string;
  locale: "ar" | "en";
  numberLocale: string;
}) {
  const claims = await prisma.investorClaim.findMany({
    where: { companyId },
    include: {
      investor: { select: { nameAr: true, nameEn: true } },
      lines: true,
    },
    orderBy: { claimDate: "desc" },
    take: 10,
  });

  type RecentClaimRow = typeof claims[number];
  type RecentClaimLineRow = RecentClaimRow["lines"][number];
  const getRecentClaimTypeLabel = (type: keyof typeof claimTypeLabels.ar) => claimTypeLabels[locale][type];
  const getRecentStatusLabel = (status: keyof typeof statusLabels.ar) => statusLabels[locale][status];

  const statusLabels = {
    ar: {
      PENDING: "معلق",
      SENT_TO_ACCOUNTANT: "أُرسل للمحاسب",
      SENT_TO_INVESTOR: "أُرسل للمسئول",
      PARTIALLY_COLLECTED: "محصل جزئياً",
      COLLECTED: "تم التحصيل",
      COMPLETED: "تم التنفيذ",
      PAID: "مدفوع",
      RENEWED: "تم التجديد",
      OVERDUE: "متأخر",
      SETTLED: "مسوى",
      CANCELLED: "ملغي",
    },
    en: {
      PENDING: "Pending",
      SENT_TO_ACCOUNTANT: "Sent to accountant",
      SENT_TO_INVESTOR: "Sent to investor",
      PARTIALLY_COLLECTED: "Partially collected",
      COLLECTED: "Collected",
      COMPLETED: "Completed",
      PAID: "Paid",
      RENEWED: "Renewed",
      OVERDUE: "Overdue",
      SETTLED: "Settled",
      CANCELLED: "Cancelled",
    },
  } as const;

  const claimTypeLabels = {
    ar: {
      LICENSE_RENEWAL: "تجديد رخصة",
      RESIDENCY_RENEWAL: "تجديد إقامة",
      RENT: "إيجار",
      SALARY_FUNDING: "رواتب",
      ADMIN_FEE: "رسوم إدارية",
      FINE: "غرامة",
      OTHER: "أخرى",
    },
    en: {
      LICENSE_RENEWAL: "License renewal",
      RESIDENCY_RENEWAL: "Residency renewal",
      RENT: "Rent",
      SALARY_FUNDING: "Salaries",
      ADMIN_FEE: "Administrative fee",
      FINE: "Fine",
      OTHER: "Other",
    },
  } as const;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="ar-table">
        <thead>
          <tr>
            <th>{locale === "en" ? "Investor" : "المسئول والمدير"}</th>
            <th>{locale === "en" ? "Type" : "النوع"}</th>
            <th>{locale === "en" ? "Description" : "البيان"}</th>
            <th>{locale === "en" ? "Collected" : "المبلغ المجمّع"}</th>
            <th>{locale === "en" ? "Actual" : "الفعلي"}</th>
            <th>{locale === "en" ? "Income" : "الهامش"}</th>
            <th>{locale === "en" ? "Status" : "الحالة"}</th>
          </tr>
        </thead>
        <tbody>
          {claims.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                {locale === "en" ? "No claims found" : "لا توجد مطالبات"}
              </td>
            </tr>
          ) : (
            claims.map((claim: RecentClaimRow) => {
              const totalCollected = claim.lines.reduce((sum: number, line: RecentClaimLineRow) => sum + Number(line.collectedAmount), 0);
              const totalActual = claim.lines.reduce((sum: number, line: RecentClaimLineRow) => sum + Number(line.actualAmount), 0);
              const totalIncome = claim.lines.reduce((sum: number, line: RecentClaimLineRow) => sum + Number(line.groupIncome), 0);
              const investorName = locale === "en" ? claim.investor.nameEn ?? claim.investor.nameAr : claim.investor.nameAr;

              return (
                <tr key={claim.id} className="transition-colors hover:bg-muted/20">
                  <td className="font-medium">{investorName}</td>
                  <td>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {getRecentClaimTypeLabel(claim.type)}
                    </span>
                  </td>
                  <td className="max-w-40 truncate text-sm">{claim.descriptionAr}</td>
                  <td className="number text-blue-600">{formatKWD(totalCollected, numberLocale)}</td>
                  <td className="number text-red-600">{formatKWD(totalActual, numberLocale)}</td>
                  <td className="font-bold number text-green-600">{formatKWD(totalIncome, numberLocale)}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        claim.status === "PAID" || claim.status === "RENEWED" || claim.status === "SETTLED"
                          ? "bg-green-100 text-green-700"
                          : claim.status === "OVERDUE"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {getRecentStatusLabel(claim.status)}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
