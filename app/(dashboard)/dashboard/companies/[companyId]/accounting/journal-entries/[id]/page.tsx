import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { JournalEntryActions } from "./journal-entry-actions";

interface Props {
  params: Promise<{ companyId: string; id: string }>;
}

const typeLabels: Record<string, string> = {
  GENERAL: "قيد عام",
  RECEIPT: "قبض",
  PAYMENT: "صرف",
  TRANSFER: "تحويل",
  SALARY: "رواتب",
  DELIVERY_INCOME: "إيراد توصيل",
  DELIVERY_WALLET: "محفظة توصيل",
  CAR_WASH_REVENUE: "إيراد غسيل",
  KNET_SETTLEMENT: "تسوية KNET",
  INVESTOR_COLLECTION: "تحصيل مسؤول",
  INVESTOR_SALARY_COLLECTION: "تحصيل رواتب مسؤول",
  INVESTOR_SALARY_DISBURSEMENT: "صرف رواتب مسؤول",
  EXPENSE: "مصروف",
  ADJUSTMENT: "تسوية",
  OPENING_BALANCE: "رصيد افتتاحي",
  DEPRECIATION: "إهلاك",
};

const statusLabels: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الموافقة",
  APPROVED: "معتمد",
  POSTED: "مرحّل",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
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

  const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);

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
  };

  const isPrintable = entry.type === "RECEIPT" || entry.type === "PAYMENT";

  return (
    <div>
      <Header
        title={`قيد رقم ${entry.number}`}
        subtitle={typeLabels[entry.type] ?? entry.type}
        companyId={companyId}
      />

      <div className="page-container max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            العودة للقيود
          </Link>

          <div className="flex items-center gap-2">
            {isPrintable && (
              <Link
                href={`/dashboard/companies/${companyId}/accounting/journal-entries/${id}/print`}
                target="_blank"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Printer size={15} />
                طباعة
              </Link>
            )}

            <JournalEntryActions
              entryId={id}
              companyId={companyId}
              isLocked={entry.fiscalYear.isLocked}
              availableActions={availableActions}
            />
          </div>
        </div>

        <div className="section-card">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">رقم القيد</p>
              <p className="font-mono font-bold">{entry.number}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">التاريخ</p>
              <p className="font-medium">{new Date(entry.date).toLocaleDateString("ar-KW")}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">النوع</p>
              <p className="font-medium">{typeLabels[entry.type] ?? entry.type}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">الحالة</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[entry.status] ?? "bg-muted"}`}>
                {statusLabels[entry.status] ?? entry.status}
              </span>
            </div>
            <div className="col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">البيان</p>
              <p className="font-medium">{entry.descriptionAr}</p>
            </div>
            {entry.reference && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">المرجع</p>
                <p className="font-mono text-sm">{entry.reference}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">السنة المالية</p>
              <p className="font-medium">
                {entry.fiscalYear.year}
                {entry.fiscalYear.isLocked && <span className="mr-2 text-xs text-red-500">(مقفلة)</span>}
              </p>
            </div>
            {entry.costCenter && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">مركز التكلفة</p>
                <p className="font-medium">{entry.costCenter.nameAr}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">أنشئ بواسطة</p>
              <p className="text-sm">{entry.createdBy.nameAr}</p>
            </div>
            {entry.approvedBy && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">اعتمد بواسطة</p>
                <p className="text-sm">{entry.approvedBy.nameAr}</p>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">سطور القيد</h3>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>كود الحساب</th>
                  <th>اسم الحساب</th>
                  <th>البيان</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="text-xs text-muted-foreground">{index + 1}</td>
                    <td className="font-mono text-xs">{line.account.code}</td>
                    <td className="text-sm font-medium">{line.account.nameAr}</td>
                    <td className="text-sm text-muted-foreground">{line.descriptionAr ?? "—"}</td>
                    <td className={`number font-bold ${Number(line.debit) > 0 ? "text-blue-600" : "text-muted-foreground/40"}`}>
                      {Number(line.debit) > 0 ? Number(line.debit).toFixed(3) : "—"}
                    </td>
                    <td className={`number font-bold ${Number(line.credit) > 0 ? "text-green-600" : "text-muted-foreground/40"}`}>
                      {Number(line.credit) > 0 ? Number(line.credit).toFixed(3) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-bold">
                  <td colSpan={4} className="px-4 py-2 text-center">الإجمالي</td>
                  <td className="number px-4 py-2 text-blue-600">{totalDebit.toFixed(3)}</td>
                  <td className="number px-4 py-2 text-green-600">{totalCredit.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {Math.abs(totalDebit - totalCredit) > 0.001 && (
            <p className="mt-2 text-sm text-red-500">القيد غير متوازن - الفرق: {Math.abs(totalDebit - totalCredit).toFixed(3)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
