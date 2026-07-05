import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
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

export default async function KnetPrintPage({ params, searchParams }: Props) {
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

  const [settlements, unsettledTotal] = await Promise.all([
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
  ]);

  type KnetSettlementItem = typeof settlements[number];
  const totalGross = settlements.reduce((sum: number, settlement: KnetSettlementItem) => sum + Number(settlement.grossAmount), 0);
  const totalCommission = settlements.reduce((sum: number, settlement: KnetSettlementItem) => sum + Number(settlement.commission), 0);
  const totalNet = settlements.reduce((sum: number, settlement: KnetSettlementItem) => sum + Number(settlement.netAmount), 0);
  const pendingAmount = Number(unsettledTotal._sum.amount ?? 0);
  const pendingCount = unsettledTotal._count.id;

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <PrintControls backHref={`/dashboard/companies/${companyId}/car-wash/knet`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b pb-4 text-center">
          <h1 className="text-2xl font-bold">{locale === "en" ? "KNET Settlements Report" : "تقرير تسوية KNET"}</h1>
          <p className="mt-2 text-sm text-gray-600">{MONTHS[locale][month - 1]} {year}</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Settlements" : "عدد التسويات"}</div>
            <div className="mt-1 text-2xl font-bold">{settlements.length}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Gross KNET" : "إجمالي KNET"}</div>
            <div className="mt-1 text-2xl font-bold">{formatKWD(totalGross, numberLocale)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Commission" : "العمولة"}</div>
            <div className="mt-1 text-2xl font-bold">{formatKWD(totalCommission, numberLocale)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Unsettled" : "غير مسوى"}</div>
            <div className="mt-1 text-xl font-bold">{pendingCount} / {formatKWD(pendingAmount, numberLocale)}</div>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">{locale === "en" ? "Date" : "التاريخ"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Bank account" : "الحساب البنكي"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Transactions" : "المعاملات"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Gross" : "الإجمالي"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Commission" : "العمولة"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Net" : "الصافي"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Notes" : "الملاحظات"}</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement: KnetSettlementItem) => (
              <tr key={settlement.id}>
                <td className="border p-2">{formatDate(settlement.settlementDate, numberLocale)}</td>
                <td className="border p-2">{locale === "en" ? settlement.bankAccount.nameEn ?? settlement.bankAccount.nameAr : settlement.bankAccount.nameAr}</td>
                <td className="border p-2">{settlement.transactions.length}</td>
                <td className="border p-2">{formatKWD(Number(settlement.grossAmount), numberLocale)}</td>
                <td className="border p-2">{formatKWD(Number(settlement.commission), numberLocale)}</td>
                <td className="border p-2">{formatKWD(Number(settlement.netAmount), numberLocale)}</td>
                <td className="border p-2">{settlement.notes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border p-2 text-right" colSpan={3}>{locale === "en" ? "Total" : "الإجمالي"}</td>
              <td className="border p-2">{formatKWD(totalGross, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totalCommission, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totalNet, numberLocale)}</td>
              <td className="border p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
