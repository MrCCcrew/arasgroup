import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
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

export default async function CarWashProfitabilityPrintPage({ params, searchParams }: Props) {
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

  const vehicles = await prisma.carWashVehicle.findMany({
    where: { companyId },
    include: {
      operations: {
        where: { date: { gte: monthStart, lte: monthEnd } },
        select: {
          totalCash: true,
          totalKnet: true,
          totalExpenses: true,
          netRevenue: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  type ProfitabilityVehicleItem = typeof vehicles[number];
  type ProfitabilityOperationItem = ProfitabilityVehicleItem["operations"][number];
  const rows = vehicles.map((vehicle: ProfitabilityVehicleItem) => {
    const totalCash = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalCash), 0);
    const totalKnet = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalKnet), 0);
    const totalExpenses = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalExpenses), 0);
    const netRevenue = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.netRevenue), 0);
    const operationDays = vehicle.operations.length;

    return {
      id: vehicle.id,
      code: vehicle.code,
      name: locale === "en" ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr,
      operationDays,
      totalCash,
      totalKnet,
      grossRevenue: totalCash + totalKnet,
      totalExpenses,
      netRevenue,
      avgDaily: operationDays > 0 ? netRevenue / operationDays : 0,
    };
  });
  type ProfitabilityRow = typeof rows[number];

  const totals = rows.reduce(
    (acc: { operationDays: number; totalCash: number; totalKnet: number; grossRevenue: number; totalExpenses: number; netRevenue: number }, row: ProfitabilityRow) => ({
      operationDays: acc.operationDays + row.operationDays,
      totalCash: acc.totalCash + row.totalCash,
      totalKnet: acc.totalKnet + row.totalKnet,
      grossRevenue: acc.grossRevenue + row.grossRevenue,
      totalExpenses: acc.totalExpenses + row.totalExpenses,
      netRevenue: acc.netRevenue + row.netRevenue,
    }),
    { operationDays: 0, totalCash: 0, totalKnet: 0, grossRevenue: 0, totalExpenses: 0, netRevenue: 0 }
  );

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <PrintControls backHref={`/dashboard/companies/${companyId}/car-wash/profitability`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b pb-4 text-center">
          <h1 className="text-2xl font-bold">{locale === "en" ? "Vehicle Profitability Report" : "تقرير ربحية المركبات"}</h1>
          <p className="mt-2 text-sm text-gray-600">{MONTHS[locale][month - 1]} {year}</p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">{locale === "en" ? "Code" : "الكود"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Vehicle" : "المركبة"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Days" : "الأيام"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Cash" : "نقدي"}</th>
              <th className="border p-2 text-right">KNET</th>
              <th className="border p-2 text-right">{locale === "en" ? "Gross" : "الإجمالي"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Expenses" : "المصروفات"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Net" : "الصافي"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Daily avg" : "المتوسط اليومي"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: ProfitabilityRow) => (
              <tr key={row.id}>
                <td className="border p-2">{row.code}</td>
                <td className="border p-2">{row.name}</td>
                <td className="border p-2">{row.operationDays}</td>
                <td className="border p-2">{formatKWD(row.totalCash, numberLocale)}</td>
                <td className="border p-2">{formatKWD(row.totalKnet, numberLocale)}</td>
                <td className="border p-2">{formatKWD(row.grossRevenue, numberLocale)}</td>
                <td className="border p-2">{formatKWD(row.totalExpenses, numberLocale)}</td>
                <td className="border p-2">{formatKWD(row.netRevenue, numberLocale)}</td>
                <td className="border p-2">{formatKWD(row.avgDaily, numberLocale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border p-2 text-right" colSpan={2}>{locale === "en" ? "Total" : "الإجمالي"}</td>
              <td className="border p-2">{totals.operationDays}</td>
              <td className="border p-2">{formatKWD(totals.totalCash, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totals.totalKnet, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totals.grossRevenue, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totals.totalExpenses, numberLocale)}</td>
              <td className="border p-2">{formatKWD(totals.netRevenue, numberLocale)}</td>
              <td className="border p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
