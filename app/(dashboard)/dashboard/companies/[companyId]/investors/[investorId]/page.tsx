import Link from "next/link";
import { CreditCard, FileText, Mail, MapPin, Phone, Plus, Pencil } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { InvestorDeleteButton } from "./InvestorDeleteButton";

interface Props {
  params: Promise<{ companyId: string; investorId: string }>;
}

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

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SENT_TO_ACCOUNTANT: "bg-blue-100 text-blue-700",
  PARTIALLY_COLLECTED: "bg-sky-100 text-sky-700",
  COLLECTED: "bg-green-100 text-green-700",
  PAID: "bg-green-100 text-green-700",
  RENEWED: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function InvestorDetailPage({ params }: Props) {
  const { companyId, investorId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const investor = await prisma.investor.findUnique({
    where: { id: investorId, isActive: true },
    include: {
      investorBranches: {
        where: { isActive: true, branch: { companyId } },
        include: { branch: { select: { id: true, nameAr: true, nameEn: true } } },
      },
    },
  });

  if (!investor) notFound();

  const claims = await prisma.investorClaim.findMany({
    where: { investorId, companyId },
    include: {
      branch: { select: { nameAr: true, nameEn: true } },
      lines: true,
      payments: { orderBy: { paymentDate: "desc" }, take: 3 },
    },
    orderBy: { claimDate: "desc" },
  });

  const totalClaims = claims.length;
  const openClaims = claims.filter((claim) => ["PENDING", "PARTIALLY_COLLECTED", "SENT_TO_ACCOUNTANT", "OVERDUE"].includes(claim.status)).length;
  const totalCollected = claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + Number(line.collectedAmount), 0), 0);
  const totalIncome = claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + Number(line.groupIncome), 0), 0);

  const investorName = locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr;

  return (
    <div>
      <Header
        title={investorName}
        subtitle={locale === "en" ? "Investor profile" : "ملف المسئول"}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/companies/${companyId}/investors/${investorId}/edit`}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil size={15} />
              {locale === "en" ? "Edit" : "تعديل"}
            </Link>
            {session.isSuperAdmin && (
              <InvestorDeleteButton
                investorId={investorId}
                companyId={companyId}
                investorName={investorName}
              />
            )}
            <Link
              href={`/dashboard/companies/${companyId}/investors/claims/new?investorId=${investorId}`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New claim" : "مطالبة جديدة"}
            </Link>
          </div>
        }
      />

      <div className="page-container space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Investor information" : "بيانات المسئول"}
            </h2>

            {investor.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="shrink-0 text-muted-foreground" />
                <span className="number" dir="ltr">{investor.phone}</span>
              </div>
            )}
            {investor.phone2 && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="shrink-0 text-muted-foreground" />
                <span className="number" dir="ltr">{investor.phone2}</span>
              </div>
            )}
            {investor.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="shrink-0 text-muted-foreground" />
                <span>{investor.email}</span>
              </div>
            )}
            {investor.civilId && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard size={14} className="shrink-0 text-muted-foreground" />
                <span className="number" dir="ltr">{investor.civilId}</span>
              </div>
            )}
            {investor.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="shrink-0 text-muted-foreground" />
                <span>{investor.address}</span>
              </div>
            )}
            {investor.notes && (
              <div className="flex items-start gap-2 border-t pt-2 text-sm">
                <FileText size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{investor.notes}</span>
              </div>
            )}

            {investor.investorBranches.length > 0 && (
              <div className="border-t pt-2">
                <p className="mb-2 text-xs text-muted-foreground">{locale === "en" ? "Linked branches" : "الفروع المرتبطة"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {investor.investorBranches.map((item) => (
                    <span key={item.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {locale === "en" ? item.branch.nameEn ?? item.branch.nameAr : item.branch.nameAr}
                      {Number(item.ownershipPct) !== 100 && (
                        <span className="me-1 text-muted-foreground">({Number(item.ownershipPct)}%)</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:col-span-2 sm:grid-cols-4">
            <StatCard label={locale === "en" ? "Total claims" : "إجمالي المطالبات"} value={String(totalClaims)} color="text-foreground" />
            <StatCard label={locale === "en" ? "Open claims" : "مطالبات مفتوحة"} value={String(openClaims)} color="text-orange-600" />
            <StatCard label={locale === "en" ? "Total collected" : "إجمالي المحصل"} value={formatKWD(totalCollected, numberLocale)} color="text-blue-600" />
            <StatCard label={locale === "en" ? "Group income" : "دخل المجموعة"} value={formatKWD(totalIncome, numberLocale)} color="text-green-600" />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-bold">{locale === "en" ? "Claims" : "المطالبات"}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                  <th>{locale === "en" ? "Collected" : "المحصل"}</th>
                  <th>{locale === "en" ? "Actual" : "الفعلي"}</th>
                  <th>{locale === "en" ? "Income" : "الهامش"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      {locale === "en" ? "No claims found for this investor" : "لا توجد مطالبات لهذا المسئول"}
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => {
                    const collected = claim.lines.reduce((sum, line) => sum + Number(line.collectedAmount), 0);
                    const actual = claim.lines.reduce((sum, line) => sum + Number(line.actualAmount), 0);
                    const income = claim.lines.reduce((sum, line) => sum + Number(line.groupIncome), 0);

                    return (
                      <tr key={claim.id} className="transition-colors hover:bg-muted/20">
                        <td className="whitespace-nowrap text-muted-foreground">{formatDate(claim.claimDate, dateLocale)}</td>
                        <td>
                          <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs">
                            {claimTypeLabels[locale][claim.type]}
                          </span>
                        </td>
                        <td className="max-w-48 truncate text-sm">{claim.descriptionAr}</td>
                        <td className="text-sm text-muted-foreground">
                          {claim.branch ? (locale === "en" ? claim.branch.nameEn ?? claim.branch.nameAr : claim.branch.nameAr) : locale === "en" ? "No branch" : "بدون فرع"}
                        </td>
                        <td className="number text-blue-600">{formatKWD(collected, numberLocale)}</td>
                        <td className="number text-red-600">{formatKWD(actual, numberLocale)}</td>
                        <td className="font-bold number text-green-600">{formatKWD(income, numberLocale)}</td>
                        <td>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${statusColors[claim.status] ?? "bg-muted text-muted-foreground"}`}>
                            {statusLabels[locale][claim.status]}
                          </span>
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
