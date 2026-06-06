import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, FileDown, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { KnetSettlementRowActions } from "@/components/car-wash/knet-settlement-row-actions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

export default async function KnetSettlementsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const year = sp.year ? Number.parseInt(sp.year, 10) : new Date().getFullYear();
  const month = sp.month ? Number.parseInt(sp.month, 10) : new Date().getMonth() + 1;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const [settlements, unsettledTotal, bankAccounts] = await Promise.all([
    prisma.knetSettlement.findMany({
      where: {
        companyId,
        settlementDate: { gte: monthStart, lte: monthEnd },
      },
      include: {
        bankAccount: { select: { nameAr: true, nameEn: true } },
        transactions: { select: { id: true } },
      },
      orderBy: [{ settlementDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.knetTransaction.aggregate({
      where: {
        isSettled: false,
        operation: { companyId },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, bankName: true },
      orderBy: { nameAr: "asc" },
    }),
  ]);

  const totalGross = settlements.reduce((sum, settlement) => sum + Number(settlement.grossAmount), 0);
  const totalCommission = settlements.reduce((sum, settlement) => sum + Number(settlement.commission), 0);
  const totalNet = settlements.reduce((sum, settlement) => sum + Number(settlement.netAmount), 0);
  const pendingAmount = Number(unsettledTotal._sum.amount ?? 0);
  const pendingCount = unsettledTotal._count.id;

  return (
    <div>
      <Header
        title={locale === "en" ? "KNET Settlements" : "تسوية KNET"}
        subtitle={locale === "en" ? "Electronic payment settlement records" : "تسويات مبالغ الدفع الإلكتروني"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/knet/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New settlement" : "تسوية جديدة"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <Clock size={16} className="shrink-0" />
            <span>
              {locale === "en"
                ? `There are ${pendingCount} unsettled KNET transaction(s) worth ${formatKWD(pendingAmount, numberLocale)}`
                : `يوجد ${pendingCount} معاملة KNET غير مسواة بقيمة إجمالية ${formatKWD(pendingAmount, numberLocale)}`}
            </span>
          </div>
        )}

        <form method="get" className="section-card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Month" : "الشهر"}</label>
              <select name="month" defaultValue={month} className="input-field">
                {MONTHS[locale].map((monthName, index) => (
                  <option key={index + 1} value={index + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Year" : "السنة"}</label>
              <select name="year" defaultValue={year} className="input-field">
                {[2024, 2025, 2026].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              {locale === "en" ? "Filter" : "بحث"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/car-wash/knet/print?month=${month}&year=${year}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              <FileDown size={16} />
              PDF
            </Link>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Settlements count" : "عدد التسويات"}</span>
            <span className="text-2xl font-bold">{settlements.length}</span>
          </div>
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Gross KNET" : "إجمالي KNET"}</span>
            <span className="number text-2xl font-bold">{formatKWD(totalGross, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Bank commission" : "العمولة البنكية"}</span>
            <span className="number text-2xl font-bold text-red-600">{formatKWD(totalCommission, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Net received" : "صافي المستلم"}</span>
            <span className="number text-2xl font-bold text-green-600">{formatKWD(totalNet, numberLocale)}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Settlement date" : "تاريخ التسوية"}</th>
                  <th>{locale === "en" ? "Bank account" : "الحساب البنكي"}</th>
                  <th>{locale === "en" ? "Transactions count" : "عدد المعاملات"}</th>
                  <th>{locale === "en" ? "Gross KNET" : "إجمالي KNET"}</th>
                  <th>{locale === "en" ? "Commission" : "العمولة"}</th>
                  <th>{locale === "en" ? "Net transfer" : "صافي المحول"}</th>
                  <th>{locale === "en" ? "Notes" : "ملاحظات"}</th>
                  <th>{locale === "en" ? "Journal entry" : "القيد"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      {locale === "en"
                        ? `No settlements found for ${MONTHS.en[month - 1]} ${year}`
                        : `لا توجد تسويات في ${MONTHS.ar[month - 1]} ${year}`}
                    </td>
                  </tr>
                ) : (
                  settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-muted/10">
                      <td className="text-sm">{formatDate(settlement.settlementDate, numberLocale)}</td>
                      <td className="text-sm">
                        {locale === "en" ? settlement.bankAccount.nameEn ?? settlement.bankAccount.nameAr : settlement.bankAccount.nameAr}
                      </td>
                      <td className="number text-center">{settlement.transactions.length}</td>
                      <td className="number font-medium">{formatKWD(Number(settlement.grossAmount), numberLocale)}</td>
                      <td className="number text-red-600">{formatKWD(Number(settlement.commission), numberLocale)}</td>
                      <td className="number font-bold text-green-600">{formatKWD(Number(settlement.netAmount), numberLocale)}</td>
                      <td className="text-sm text-muted-foreground">{settlement.notes ?? "-"}</td>
                      <td>
                        {settlement.journalEntryId ? (
                          <CheckCircle size={16} className="mx-auto text-green-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{locale === "en" ? "None" : "لا يوجد"}</span>
                        )}
                      </td>
                      <td>
                        <KnetSettlementRowActions
                          settlementId={settlement.id}
                          settlementDate={settlement.settlementDate.toISOString()}
                          grossAmount={settlement.grossAmount.toString()}
                          commission={settlement.commission.toString()}
                          netAmount={settlement.netAmount.toString()}
                          bankAccountId={settlement.bankAccountId}
                          notes={settlement.notes}
                          bankAccounts={bankAccounts}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {settlements.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td colSpan={3} className="py-2 text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="number">{formatKWD(totalGross, numberLocale)}</td>
                    <td className="number text-red-600">{formatKWD(totalCommission, numberLocale)}</td>
                    <td className="number text-green-600">{formatKWD(totalNet, numberLocale)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
