import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ClaimStatusActions } from "@/components/investors/claim-status-actions";
import { ClaimEditDeleteActions } from "@/components/investors/claim-edit-delete-actions";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ status?: string }>;
}

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

const typeLabels = {
  ar: {
    LICENSE_RENEWAL: "تجديد رخصة",
    RESIDENCY_RENEWAL: "تجديد إقامة",
    RENT: "إيجار",
    SALARY_FUNDING: "تمويل رواتب",
    ADMIN_FEE: "رسوم إدارية",
    FINE: "غرامة",
    OTHER: "أخرى",
  },
  en: {
    LICENSE_RENEWAL: "License renewal",
    RESIDENCY_RENEWAL: "Residency renewal",
    RENT: "Rent",
    SALARY_FUNDING: "Salary funding",
    ADMIN_FEE: "Administrative fee",
    FINE: "Fine",
    OTHER: "Other",
  },
} as const;

const statusColors: Record<string, string> = {
  PENDING:              "bg-yellow-50 text-yellow-700",
  SENT_TO_ACCOUNTANT:   "bg-blue-50 text-blue-700",
  SENT_TO_INVESTOR:     "bg-indigo-50 text-indigo-700",
  PARTIALLY_COLLECTED:  "bg-amber-50 text-amber-700",
  COLLECTED:            "bg-teal-50 text-teal-700",
  COMPLETED:            "bg-green-50 text-green-700",
  PAID:                 "bg-green-50 text-green-700",
  RENEWED:              "bg-emerald-50 text-emerald-700",
  OVERDUE:              "bg-red-50 text-red-700",
  SETTLED:              "bg-slate-50 text-slate-700",
  CANCELLED:            "bg-slate-100 text-slate-500 line-through",
};

export default async function ClaimsPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale  = locale === "en" ? "en-US" : "ar-KW";

  // صلاحيات المستخدم الحالي
  const canCollect = session.isSuperAdmin || hasPermission(session, "INVESTOR_CLAIMS", "COLLECT", { companyId });
  const canAdmin   = session.isSuperAdmin || hasPermission(session, "INVESTOR_CLAIMS", "UPDATE", { companyId });

  const claims = await prisma.investorClaim.findMany({
    where: {
      companyId,
      ...(query.status ? { status: query.status as never } : {}),
    },
    include: {
      investor: { select: { nameAr: true, nameEn: true, phone: true } },
      branch:   { select: { nameAr: true, nameEn: true } },
      lines: true,
    },
    orderBy: { claimDate: "desc" },
  });

  const filters = [
    "",
    "PENDING",
    "SENT_TO_ACCOUNTANT",
    "SENT_TO_INVESTOR",
    "COLLECTED",
    "COMPLETED",
    "OVERDUE",
    "CANCELLED",
  ] as const;

  return (
    <div>
      <Header
        title={locale === "en" ? "Investor Claims" : "مطالبات المسئولين والمديرين"}
        subtitle={locale === "en" ? "Claims, collections, and renewal workflow" : "سجل المطالبات والتحصيلات والتجديد"}
        companyId={companyId}
        actions={
          canAdmin ? (
            <Link
              href={`/dashboard/companies/${companyId}/investors/claims/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New claim" : "مطالبة جديدة"}
            </Link>
          ) : null
        }
      />

      <div className="page-container space-y-4">
        {/* ── فلاتر الحالة ── */}
        <div className="flex flex-wrap gap-2">
          {filters.map((status) => {
            const active = query.status === status || (!query.status && !status);
            const href   = `/dashboard/companies/${companyId}/investors/claims${status ? `?status=${status}` : ""}`;
            const label  = status
              ? statusLabels[locale][status as keyof typeof statusLabels.ar]
              : locale === "en" ? "All" : "الكل";
            return (
              <Link
                key={status}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Investor" : "المسئول والمدير"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                  <th>{locale === "en" ? "Claim date" : "تاريخ المطالبة"}</th>
                  <th>{locale === "en" ? "Due date" : "تاريخ الاستحقاق"}</th>
                  <th>{locale === "en" ? "Required" : "المبلغ المطلوب"}</th>
                  <th>{locale === "en" ? "Collected" : "المحصل"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Actions" : "الإجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No investor claims found" : "لا توجد مطالبات مسئولين"}
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => {
                    const totalActual    = claim.lines.reduce((s, l) => s + Number(l.actualAmount), 0);
                    const totalCollected = claim.lines.reduce((s, l) => s + Number(l.collectedAmount), 0);
                    const investorName   = locale === "en" ? claim.investor.nameEn ?? claim.investor.nameAr : claim.investor.nameAr;
                    const branchName     = claim.branch
                      ? (locale === "en" ? claim.branch.nameEn ?? claim.branch.nameAr : claim.branch.nameAr)
                      : (locale === "en" ? "No branch" : "بدون فرع");

                    return (
                      <tr key={claim.id} className="align-top hover:bg-muted/30">
                        <td className="font-medium">{investorName}</td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {typeLabels[locale][claim.type]}
                          </span>
                        </td>
                        <td className="text-sm text-muted-foreground">{branchName}</td>
                        <td className="text-sm">{formatDate(claim.claimDate, dateLocale)}</td>
                        <td className="text-sm">
                          {claim.dueDate ? formatDate(claim.dueDate, dateLocale) : (locale === "en" ? "—" : "—")}
                        </td>
                        <td className="number text-sm">{formatKWD(totalActual, numberLocale)}</td>
                        <td className={`number text-sm font-bold ${totalCollected > 0 ? "text-teal-700" : "text-muted-foreground"}`}>
                          {totalCollected > 0 ? formatKWD(totalCollected, numberLocale) : "—"}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status] ?? "bg-muted text-muted-foreground"}`}>
                            {statusLabels[locale][claim.status as keyof typeof statusLabels.ar] ?? claim.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <ClaimStatusActions
                              claimId={claim.id}
                              status={claim.status}
                              canCollect={canCollect}
                              canAdmin={canAdmin}
                              investorPhone={claim.investor.phone ?? null}
                              investorName={investorName}
                              claimType={claim.type}
                              claimDescription={claim.descriptionAr}
                              claimLines={claim.lines.map((l) => ({
                                id: l.id,
                                descriptionAr: l.descriptionAr,
                                actualAmount: Number(l.actualAmount),
                                collectedAmount: Number(l.collectedAmount),
                              }))}
                              dueDate={claim.dueDate ? formatDate(claim.dueDate, dateLocale) : null}
                              totalActual={totalActual}
                            />
                            <ClaimEditDeleteActions
                              claimId={claim.id}
                              status={claim.status}
                              descriptionAr={claim.descriptionAr}
                              type={claim.type}
                              dueDate={claim.dueDate ? claim.dueDate.toISOString() : null}
                              notes={claim.notes ?? null}
                            />
                          </div>
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
