import Link from "next/link";
import { Plus } from "lucide-react";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { redirect } from "next/navigation";
import type { JournalStatus } from "@prisma/client";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

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
  const statusFilter = query.status;

  const where = {
    companyId,
    isDeleted: false,
    ...(statusFilter ? { status: statusFilter as JournalStatus } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: {
        createdBy: { select: { nameAr: true, nameEn: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const filters = ["", "DRAFT", "POSTED", "PENDING_APPROVAL"] as const;

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

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Entry No." : "رقم القيد"}</th>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Total debit" : "إجمالي المدين"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Created by" : "بواسطة"}</th>
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No journal entries found" : "لا توجد قيود"}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-muted/30">
                      <td className="font-mono text-xs">{entry.number}</td>
                      <td className="text-sm">{formatDate(entry.date, dateLocale)}</td>
                      <td className="max-w-48 text-sm">
                        <p className="truncate">{locale === "en" ? entry.descriptionEn ?? entry.descriptionAr : entry.descriptionAr}</p>
                      </td>
                      <td>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {typeLabels[locale][entry.type as keyof typeof typeLabels.ar] ?? entry.type}
                        </span>
                      </td>
                      <td className="font-bold number text-blue-600">{formatKWD(Number(entry.totalDebit), numberLocale)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs status-${entry.status.toLowerCase()}`}>
                          {statusLabels[locale][entry.status]}
                        </span>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {locale === "en" ? entry.createdBy.nameEn ?? entry.createdBy.nameAr : entry.createdBy.nameAr}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}`} className="text-xs text-primary hover:underline">
                            {locale === "en" ? "View" : "عرض"}
                          </Link>
                          {(entry.type === "RECEIPT" || entry.type === "PAYMENT") && (
                            <Link
                              href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}/print`}
                              target="_blank"
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              {locale === "en" ? "Print" : "طباعة"}
                            </Link>
                          )}
                          {session.isSuperAdmin && (
                            <DeleteConfirmButton
                              apiUrl={`/api/accounting/journal-entries/${entry.id}`}
                              confirmMessage={`حذف القيد رقم ${entry.number}؟`}
                              warningMessage="سيتم عكس القيد وحذفه من السجلات المحاسبية نهائياً"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((currentPage) => (
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
