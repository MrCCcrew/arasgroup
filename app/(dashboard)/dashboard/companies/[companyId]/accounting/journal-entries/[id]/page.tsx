import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getLocale } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { JournalEntryActions } from "./journal-entry-actions";
import { MoveLineButton } from "./move-line-button";

interface Props {
  params: Promise<{ companyId: string; id: string }>;
}

const typeLabels: Record<string, { ar: string; en: string }> = {
  GENERAL: { ar: "قيد عام", en: "General entry" },
  RECEIPT: { ar: "قبض", en: "Receipt" },
  PAYMENT: { ar: "صرف", en: "Payment" },
  TRANSFER: { ar: "تحويل", en: "Transfer" },
  SALARY: { ar: "رواتب", en: "Salaries" },
  DELIVERY_INCOME: { ar: "إيراد توصيل", en: "Delivery income" },
  DELIVERY_WALLET: { ar: "محفظة توصيل", en: "Delivery wallet" },
  CAR_WASH_REVENUE: { ar: "إيراد غسيل", en: "Car wash revenue" },
  KNET_SETTLEMENT: { ar: "تسوية KNET", en: "KNET settlement" },
  INVESTOR_COLLECTION: { ar: "تحصيل مسؤول", en: "Investor collection" },
  INVESTOR_SALARY_COLLECTION: { ar: "تحصيل رواتب مسؤول", en: "Investor salary collection" },
  INVESTOR_SALARY_DISBURSEMENT: { ar: "صرف رواتب مسؤول", en: "Investor salary disbursement" },
  EXPENSE: { ar: "مصروف", en: "Expense" },
  ADJUSTMENT: { ar: "تسوية", en: "Adjustment" },
  OPENING_BALANCE: { ar: "رصيد افتتاحي", en: "Opening balance" },
  DEPRECIATION: { ar: "إهلاك", en: "Depreciation" },
  REVERSAL: { ar: "قيد عكسي", en: "Reversal entry" },
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  PENDING_APPROVAL: { ar: "بانتظار الموافقة", en: "Pending approval" },
  APPROVED: { ar: "معتمد", en: "Approved" },
  POSTED: { ar: "مرحّل", en: "Posted" },
  REJECTED: { ar: "مرفوض", en: "Rejected" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  POSTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function JournalEntryDetailPage({ params }: Props) {
  const { companyId, id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const entry = await prisma.journalEntry.findUnique({
    where: { id, companyId, isDeleted: false },
    include: {
      lines: {
        include: {
          account: { select: { code: true, nameAr: true, type: true } },
          costCenter: { select: { code: true, nameAr: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      createdBy: { select: { nameAr: true } },
      approvedBy: { select: { nameAr: true } },
      fiscalYear: { select: { year: true, isLocked: true } },
      costCenter: { select: { code: true, nameAr: true } },
    },
  });

  if (!entry) notFound();

  const en = (await getLocale()) === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const lang = en ? "en" : "ar";
  const typeLabel = typeLabels[entry.type]?.[lang] ?? entry.type;
  const statusLabel = statusLabels[entry.status]?.[lang] ?? entry.status;
  const t = {
    entryNo: en ? "Entry no." : "رقم القيد",
    back: en ? "Back to entries" : "العودة للقيود",
    print: en ? "Print" : "طباعة",
    date: en ? "Date" : "التاريخ",
    type: en ? "Type" : "النوع",
    status: en ? "Status" : "الحالة",
    statement: en ? "Statement" : "البيان",
    reference: en ? "Reference" : "المرجع",
    fiscalYear: en ? "Fiscal year" : "السنة المالية",
    locked: en ? "(locked)" : "(مقفلة)",
    costCenter: en ? "Cost center" : "مركز التكلفة",
    createdBy: en ? "Created by" : "أنشئ بواسطة",
    approvedBy: en ? "Approved by" : "اعتمد بواسطة",
    lines: en ? "Entry lines" : "سطور القيد",
    accountCode: en ? "Account code" : "كود الحساب",
    accountName: en ? "Account name" : "اسم الحساب",
    debit: en ? "Debit" : "مدين",
    credit: en ? "Credit" : "دائن",
    total: en ? "Total" : "الإجمالي",
    unbalanced: (d: string) => (en ? `Entry is unbalanced — difference: ${d}` : `القيد غير متوازن - الفرق: ${d}`),
  };

  const totalDebit = entry.lines.reduce((sum: number, line: typeof entry.lines[number]) => sum + Number(line.debit), 0);
  const totalCredit = entry.lines.reduce((sum: number, line: typeof entry.lines[number]) => sum + Number(line.credit), 0);

  const canUpdate = hasPermission(session, "ACCOUNTING", "UPDATE", { companyId });
  const canApprove = hasPermission(session, "ACCOUNTING", "APPROVE", { companyId });
  const canDelete = hasPermission(session, "ACCOUNTING", "DELETE", { companyId });

  const availableActions = {
    submit: canUpdate && (entry.status === "DRAFT" || entry.status === "REJECTED"),
    approve: canApprove && (entry.status === "DRAFT" || entry.status === "PENDING_APPROVAL"),
    reject: canApprove && entry.status === "PENDING_APPROVAL",
    post: canUpdate && (entry.status === "DRAFT" || entry.status === "PENDING_APPROVAL" || entry.status === "APPROVED"),
    revert: canUpdate && ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"].includes(entry.status),
    cancel: canUpdate && ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(entry.status),
    delete: canDelete && !entry.isAutomatic && ["DRAFT", "REJECTED", "CANCELLED"].includes(entry.status),
    reverse: canUpdate && entry.status === "POSTED" && !(entry as any).isReversed,
  };

  const isPrintable = entry.type === "RECEIPT" || entry.type === "PAYMENT";

  return (
    <div>
      <Header
        title={`${t.entryNo} ${entry.number}`}
        subtitle={typeLabel}
        companyId={companyId}
      />

      <div className="page-container max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {t.back}
          </Link>

          <div className="flex items-center gap-2">
            {isPrintable && (
              <Link
                href={`/dashboard/companies/${companyId}/accounting/journal-entries/${id}/print`}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Printer size={15} />
                {t.print}
              </Link>
            )}

            <JournalEntryActions
              entryId={id}
              companyId={companyId}
              isLocked={entry.fiscalYear.isLocked}
              availableActions={availableActions}
              locale={lang}
            />
          </div>
        </div>

        <div className="section-card">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.entryNo}</p>
              <p className="font-mono font-bold">{entry.number}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.date}</p>
              <p className="font-medium">{new Date(entry.date).toLocaleDateString(numberLocale)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.type}</p>
              <p className="font-medium">{typeLabel}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.status}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[entry.status] ?? "bg-muted"}`}>
                {statusLabel}
              </span>
            </div>
            <div className="col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">{t.statement}</p>
              <p className="font-medium">{entry.descriptionAr}</p>
            </div>
            {entry.reference && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t.reference}</p>
                <p className="font-mono text-sm">{entry.reference}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.fiscalYear}</p>
              <p className="font-medium">
                {entry.fiscalYear.year}
                {entry.fiscalYear.isLocked && <span className="mr-2 text-xs text-red-500">{t.locked}</span>}
              </p>
            </div>
            {entry.costCenter && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t.costCenter}</p>
                <p className="font-medium">{entry.costCenter.nameAr}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t.createdBy}</p>
              <p className="text-sm">{entry.createdBy.nameAr}</p>
            </div>
            {entry.approvedBy && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t.approvedBy}</p>
                <p className="text-sm">{entry.approvedBy.nameAr}</p>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.lines}</h3>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.accountCode}</th>
                  <th>{t.accountName}</th>
                  <th>{t.statement}</th>
                  <th>{t.debit}</th>
                  <th>{t.credit}</th>
                  {canUpdate && <th></th>}
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line: typeof entry.lines[number], index: number) => (
                  <tr key={line.id}>
                    <td className="text-xs text-muted-foreground">{index + 1}</td>
                    <td className="font-mono text-xs">{line.account.code}</td>
                    <td className="text-sm font-medium">{line.account.nameAr}</td>{/* account name = data */}
                    <td className="text-sm text-muted-foreground">{line.descriptionAr ?? "—"}</td>
                    <td className={`number font-bold ${Number(line.debit) > 0 ? "text-blue-600" : "text-muted-foreground/40"}`}>
                      {Number(line.debit) > 0 ? Number(line.debit).toFixed(3) : "—"}
                    </td>
                    <td className={`number font-bold ${Number(line.credit) > 0 ? "text-green-600" : "text-muted-foreground/40"}`}>
                      {Number(line.credit) > 0 ? Number(line.credit).toFixed(3) : "—"}
                    </td>
                    {canUpdate && (
                      <td className="text-center">
                        <MoveLineButton entryId={entry.id} lineId={line.id} companyId={companyId} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-bold">
                  <td colSpan={4} className="px-4 py-2 text-center">{t.total}</td>
                  <td className="number px-4 py-2 text-blue-600">{totalDebit.toFixed(3)}</td>
                  <td className="number px-4 py-2 text-green-600">{totalCredit.toFixed(3)}</td>
                  {canUpdate && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {Math.abs(totalDebit - totalCredit) > 0.001 && (
            <p className="mt-2 text-sm text-red-500">{t.unbalanced(Math.abs(totalDebit - totalCredit).toFixed(3))}</p>
          )}
        </div>
      </div>
    </div>
  );
}
