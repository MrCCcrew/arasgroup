import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { JournalEntriesTable } from "@/components/accounting/journal-entries-table";
import type { JournalStatus } from "@prisma/client";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}

const statusLabels = {
  ar: {
    DRAFT: "مسودة",
    PENDING_APPROVAL: "بانتظار الموافقة",
    APPROVED: "معتمد",
    POSTED: "مرحل",
    REJECTED: "مرفوض",
    CANCELLED: "ملغي",
  },
  en: {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    POSTED: "Posted",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  },
} as const;

const typeLabels = {
  ar: {
    GENERAL: "قيد عام",
    RECEIPT: "قبض",
    PAYMENT: "صرف",
    TRANSFER: "تحويل",
    SALARY: "رواتب",
    DELIVERY_INCOME: "إيراد توصيل",
    DELIVERY_WALLET: "محفظة توصيل",
    CAR_WASH_REVENUE: "إيراد غسيل",
    KNET_SETTLEMENT: "تسوية KNET",
    INVESTOR_COLLECTION: "تحصيل مسئول",
    INVESTOR_SALARY_COLLECTION: "تحصيل رواتب مسئول",
    EXPENSE: "مصروف",
    REVERSAL: "قيد عكسي",
  },
  en: {
    GENERAL: "General entry",
    RECEIPT: "Receipt",
    PAYMENT: "Payment",
    TRANSFER: "Transfer",
    SALARY: "Salary",
    DELIVERY_INCOME: "Delivery income",
    DELIVERY_WALLET: "Delivery wallet",
    CAR_WASH_REVENUE: "Car wash revenue",
    KNET_SETTLEMENT: "KNET settlement",
    INVESTOR_COLLECTION: "Investor collection",
    INVESTOR_SALARY_COLLECTION: "Investor salary collection",
    EXPENSE: "Expense",
    REVERSAL: "Reversal entry",
  },
} as const;

export default async function JournalEntriesPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const page = parseInt(query.page ?? "1", 10);
  const pageSize = 20;
  const allowedStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED"] as const satisfies readonly JournalStatus[];
  const filters = ["", ...allowedStatuses] as const;
  const statusFilter = allowedStatuses.find((status) => status === query.status);

  const where = {
    companyId,
    isDeleted: false,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, rawEntries, unpostedCount] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        descriptionAr: true,
        descriptionEn: true,
        type: true,
        totalDebit: true,
        totalCredit: true,
        status: true,
        createdBy: { select: { nameAr: true, nameEn: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntry.count({
      where: {
        companyId,
        isDeleted: false,
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
      },
    }),
  ]);

  const entries = rawEntries.map((e) => ({ ...e, entryNumber: e.number }));

  const totalPages = Math.ceil(total / pageSize);

  const canDelete = hasPermission(session, "ACCOUNTING", "DELETE", { companyId });

  return (
    <div>
      <Header
        title={locale === "en" ? "Journal Entries" : "القيود اليومية"}
        subtitle={locale === "en" ? "General journal and accounting entries" : "دفتر اليومية والقيود المحاسبية"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/accounting/journal-entries/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New entry" : "قيد جديد"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        {unpostedCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold">
                  {locale === "en" ? "Unposted entries need review before they affect the ledger." : "يوجد قيود غير مرحلة تحتاج مراجعة قبل أن تؤثر على الأستاذ."}
                </p>
                <p className="text-sm">
                  {locale === "en"
                    ? `${unpostedCount} entries are still draft, pending approval, or approved without posting.`
                    : `${unpostedCount} قيدًا ما زال في حالة مسودة أو بانتظار اعتماد أو معتمد بدون ترحيل.`}
                </p>
              </div>
              <Link
                href={`/dashboard/companies/${companyId}/accounting/journal-entries?status=DRAFT`}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                {locale === "en" ? "Open drafts" : "فتح المسودات"}
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {filters.map((status) => {
            const active = statusFilter === status || (!statusFilter && !status);
            const href = `/dashboard/companies/${companyId}/accounting/journal-entries${status ? `?status=${status}` : ""}`;
            const label = status ? statusLabels[locale][status] : locale === "en" ? "All" : "الكل";
            return (
              <Link
                key={status}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                }`}
              >
                {label} {!status ? `(${total})` : ""}
              </Link>
            );
          })}
        </div>

        <JournalEntriesTable
          entries={entries}
          companyId={companyId}
          locale={locale}
          numberLocale={numberLocale}
          dateLocale={dateLocale}
          statusLabels={statusLabels[locale]}
          typeLabels={typeLabels[locale]}
          formatKWD={formatKWD}
          formatDate={formatDate}
          canDelete={canDelete}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_: unknown, index: number) => index + 1).map((currentPage: number) => (
              <Link
                key={currentPage}
                href={`/dashboard/companies/${companyId}/accounting/journal-entries?page=${currentPage}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  currentPage === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {currentPage}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
