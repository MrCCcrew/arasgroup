import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { SalaryBatchRowActions } from "@/components/hr/salary-batch-row-actions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD, formatMonthYear } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

const ar = {
  title: "\u062f\u0641\u0639\u0627\u062a \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  subtitle: "\u0627\u0644\u062f\u0648\u0631\u0627\u062a \u0627\u0644\u0634\u0647\u0631\u064a\u0629 \u0644\u0631\u0648\u0627\u062a\u0628 \u0645\u0648\u0638\u0641\u064a \u0627\u0644\u0634\u0631\u0643\u0629",
  newBatch: "\u062f\u0641\u0639\u0629 \u062c\u062f\u064a\u062f\u0629",
  batches: "\u062f\u0641\u0639\u0627\u062a \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  paidBatches: "\u062f\u0641\u0639\u0627\u062a \u0645\u062f\u0641\u0648\u0639\u0629",
  totalPaid: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062f\u0641\u0648\u0639",
  period: "\u0627\u0644\u0641\u062a\u0631\u0629",
  cycle: "\u0646\u0648\u0639 \u0627\u0644\u062f\u0648\u0631\u0629",
  employees: "\u0639\u062f\u062f \u0627\u0644\u0645\u0648\u0638\u0641\u064a\u0646",
  gross: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  net: "\u0635\u0627\u0641\u064a \u0627\u0644\u0645\u062f\u0641\u0648\u0639",
  status: "\u0627\u0644\u062d\u0627\u0644\u0629",
  actions: "\u0625\u062c\u0631\u0627\u0621\u0627\u062a",
  empty: "\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0641\u0639\u0627\u062a \u0631\u0648\u0627\u062a\u0628",
  draft: "\u0645\u0633\u0648\u062f\u0629",
  approved: "\u0645\u0639\u062a\u0645\u062f",
  paid: "\u0645\u062f\u0641\u0648\u0639",
  cancelled: "\u0645\u0644\u063a\u064a",
};

const statusLabels = {
  ar: {
    DRAFT: ar.draft,
    APPROVED: ar.approved,
    PAID: ar.paid,
    CANCELLED: ar.cancelled,
  },
  en: {
    DRAFT: "Draft",
    APPROVED: "Approved",
    PAID: "Paid",
    CANCELLED: "Cancelled",
  },
} as const;

export default async function SalariesPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const batches = await prisma.salaryBatch.findMany({
    where: { companyId },
    include: { _count: { select: { payments: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const journalEntries = await prisma.journalEntry.findMany({
    where: { id: { in: batches.map((batch) => batch.journalEntryId).filter(Boolean) as string[] } },
    select: { id: true, status: true, isDeleted: true },
  });
  const journalEntryMap = new Map(journalEntries.map((entry) => [entry.id, entry]));

  const totalPaid = batches
    .filter((batch) => batch.status === "PAID")
    .reduce((sum, batch) => sum + Number(batch.totalNet), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Salary Batches" : ar.title}
        subtitle={locale === "en" ? "Monthly salary cycles for company employees" : ar.subtitle}
        companyId={companyId}
        actions={(
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New Batch" : ar.newBatch}
          </Link>
        )}
      />

      <div className="page-container space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold">{batches.length}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Salary batches" : ar.batches}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold text-green-600">{batches.filter((batch) => batch.status === "PAID").length}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Paid batches" : ar.paidBatches}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="text-xl font-bold number">{formatKWD(totalPaid, numberLocale)}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Total paid" : ar.totalPaid}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Period" : ar.period}</th>
                  <th>{locale === "en" ? "Cycle" : ar.cycle}</th>
                  <th>{locale === "en" ? "Employees" : ar.employees}</th>
                  <th>{locale === "en" ? "Gross total" : ar.gross}</th>
                  <th>{locale === "en" ? "Net total" : ar.net}</th>
                  <th>{locale === "en" ? "Status" : ar.status}</th>
                  <th>{locale === "en" ? "Actions" : ar.actions}</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No salary batches found" : ar.empty}
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => {
                    const journalEntry = batch.journalEntryId ? journalEntryMap.get(batch.journalEntryId) : null;
                    const canMutate =
                      (batch.status === "DRAFT" || batch.status === "APPROVED") &&
                      (journalEntry == null || journalEntry.isDeleted || journalEntry.status !== "POSTED");
                    const canDelete =
                      (batch.status === "DRAFT" || batch.status === "APPROVED" || batch.status === "CANCELLED") &&
                      (journalEntry == null || journalEntry.isDeleted || journalEntry.status !== "POSTED");

                    return (
                      <tr key={batch.id} className="hover:bg-muted/30">
                        <td className="font-medium">{formatMonthYear(batch.month, batch.year, numberLocale)}</td>
                        <td className="text-sm text-muted-foreground">{batch.cycleType}</td>
                        <td className="text-center">{batch._count.payments}</td>
                        <td className="font-bold number">{formatKWD(Number(batch.totalGross), numberLocale)}</td>
                        <td className="font-bold number text-green-600">{formatKWD(Number(batch.totalNet), numberLocale)}</td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              batch.status === "PAID"
                                ? "bg-green-50 text-green-700"
                                : batch.status === "APPROVED"
                                  ? "bg-blue-50 text-blue-700"
                                  : batch.status === "CANCELLED"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-50 text-gray-700"
                            }`}
                          >
                            {statusLabels[locale][batch.status]}
                          </span>
                        </td>
                        <td>
                          <SalaryBatchRowActions
                            companyId={companyId}
                            batchId={batch.id}
                            locale={locale}
                            canMutate={canMutate}
                            canDelete={canDelete}
                          />
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
