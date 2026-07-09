import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, FileDown, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { KnetTabs } from "@/components/car-wash/knet-tabs";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

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

  const [settlements, unsettledTransactions, unsettledTotal, bankAccounts] = await Promise.all([
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
    prisma.knetTransaction.findMany({
      where: {
        isSettled: false,
        operation: { companyId },
      },
      include: {
        operation: {
          select: {
            id: true,
            date: true,
            totalCash: true,
            totalKnet: true,
            netRevenue: true,
            vehicle: {
              select: {
                plateNumber: true,
              },
            },
            location: {
              select: {
                nameAr: true,
              },
            },
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
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
                {MONTHS[locale].map((monthName: string, index: number) => (
                  <option key={index + 1} value={index + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Year" : "السنة"}</label>
              <select name="year" defaultValue={year} className="input-field">
                {[2024, 2025, 2026].map((value: number) => (
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

        <KnetTabs
          settlements={settlements}
          unsettledTransactions={unsettledTransactions}
          bankAccounts={bankAccounts}
          companyId={companyId}
          locale={locale}
          numberLocale={numberLocale}
          month={month}
          year={year}
          monthName={MONTHS[locale][month - 1]}
        />
      </div>
    </div>
  );
}
