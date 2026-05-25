import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { ArrowRight, Printer, CheckCircle, Send } from "lucide-react";
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
  INVESTOR_COLLECTION: "تحصيل مسئول",
  INVESTOR_SALARY_COLLECTION: "تحصيل رواتب مسئول",
  EXPENSE: "مصروف",
  ADJUSTMENT: "تسوية",
  OPENING_BALANCE: "رصيد افتتاحي",
  DEPRECIATION: "إهلاك",
};

const statusLabels: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "انتظار موافقة",
  APPROVED: "معتمد",
  POSTED: "مرحّل",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  POSTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-400",
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

  const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);

  const canPost = entry.status === "DRAFT" || entry.status === "APPROVED";
  const canApprove = entry.status === "PENDING_APPROVAL" && session.isSuperAdmin;
  const canDelete = entry.status === "DRAFT" && !entry.isAutomatic;
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
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight size={14} />
            العودة للقيود
          </Link>

          <div className="flex items-center gap-2">
            {isPrintable && (
              <Link
                href={`/dashboard/companies/${companyId}/accounting/journal-entries/${id}/print`}
                target="_blank"
                className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <Printer size={15} />
                طباعة
              </Link>
            )}
            <JournalEntryActions
              entryId={id}
              companyId={companyId}
              canPost={canPost}
              canApprove={canApprove}
              canDelete={canDelete}
              isLocked={entry.fiscalYear.isLocked}
            />
          </div>
        </div>

        {/* Entry Info */}
        <div className="section-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">رقم القيد</p>
              <p className="font-mono font-bold">{entry.number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">التاريخ</p>
              <p className="font-medium">{new Date(entry.date).toLocaleDateString("ar-KW")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">النوع</p>
              <p className="font-medium">{typeLabels[entry.type] ?? entry.type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">الحالة</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[entry.status] ?? "bg-muted"}`}>
                {statusLabels[entry.status] ?? entry.status}
              </span>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-1">البيان</p>
              <p className="font-medium">{entry.descriptionAr}</p>
            </div>
            {entry.reference && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">المرجع</p>
                <p className="font-mono text-sm">{entry.reference}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">السنة المالية</p>
              <p className="font-medium">
                {entry.fiscalYear.year}
                {entry.fiscalYear.isLocked && (
                  <span className="text-xs text-red-500 mr-2">(مقفل)</span>
                )}
              </p>
            </div>
            {entry.costCenter && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">مركز التكلفة</p>
                <p className="font-medium">{entry.costCenter.nameAr}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">أنشئ بواسطة</p>
              <p className="text-sm">{entry.createdBy.nameAr}</p>
            </div>
            {entry.approvedBy && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">اعتمد بواسطة</p>
                <p className="text-sm">{entry.approvedBy.nameAr}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines */}
        <div className="section-card">
          <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-4">سطور القيد</h3>
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
                {entry.lines.map((line, i) => (
                  <tr key={line.id}>
                    <td className="text-muted-foreground text-xs">{i + 1}</td>
                    <td className="font-mono text-xs">{line.account.code}</td>
                    <td className="font-medium text-sm">{line.account.nameAr}</td>
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
                <tr className="bg-muted/30 font-bold border-t-2">
                  <td colSpan={4} className="text-center px-4 py-2">الإجمالي</td>
                  <td className="number text-blue-600 px-4 py-2">{totalDebit.toFixed(3)}</td>
                  <td className="number text-green-600 px-4 py-2">{totalCredit.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {Math.abs(totalDebit - totalCredit) > 0.001 && (
            <p className="text-sm text-red-500 mt-2">⚠️ القيد غير متوازن — فرق: {Math.abs(totalDebit - totalCredit).toFixed(3)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
