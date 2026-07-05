import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, FileDown, TrendingDown, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
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

export default async function CarWashProfitabilityPage({ params, searchParams }: Props) {
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
          date: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  type ProfitabilityVehicleItem = typeof vehicles[number];
  type ProfitabilityOperationItem = ProfitabilityVehicleItem["operations"][number];
  const vehicleStats = vehicles.map((vehicle: ProfitabilityVehicleItem) => {
    const totalCash = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalCash), 0);
    const totalKnet = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalKnet), 0);
    const totalExpenses = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.totalExpenses), 0);
    const netRevenue = vehicle.operations.reduce((sum: number, operation: ProfitabilityOperationItem) => sum + Number(operation.netRevenue), 0);
    const grossRevenue = totalCash + totalKnet;
    const operationDays = vehicle.operations.length;
    const avgDaily = operationDays > 0 ? netRevenue / operationDays : 0;

    return {
      id: vehicle.id,
      code: vehicle.code,
      nameAr: vehicle.nameAr,
      nameEn: vehicle.nameEn,
      isActive: vehicle.isActive,
      totalCash,
      totalKnet,
      grossRevenue,
      totalExpenses,
      netRevenue,
      operationDays,
      avgDaily,
    };
  });
  type VehicleStat = typeof vehicleStats[number];

  const grandTotal = {
    grossRevenue: vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.grossRevenue, 0),
    totalExpenses: vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.totalExpenses, 0),
    netRevenue: vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.netRevenue, 0),
    operationDays: vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.operationDays, 0),
  };

  const maxNet = Math.max(...vehicleStats.map((vehicle: VehicleStat) => vehicle.netRevenue), 1);

  return (
    <div>
      <Header
        title={locale === "en" ? "Vehicle Profitability" : "ربحية المركبات"}
        subtitle={`${MONTHS[locale][month - 1]} ${year}`}
        companyId={companyId}
      />

      <div className="page-container space-y-4">
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
              {locale === "en" ? "Show" : "عرض"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/car-wash/profitability/print?month=${month}&year=${year}`}
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 size={16} />
              <span className="text-sm">{locale === "en" ? "Operation days" : "أيام التشغيل"}</span>
            </div>
            <span className="text-2xl font-bold">{grandTotal.operationDays}</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp size={16} />
              <span className="text-sm">{locale === "en" ? "Total revenue" : "إجمالي الإيرادات"}</span>
            </div>
            <span className="number text-2xl font-bold">{formatKWD(grandTotal.grossRevenue, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-red-600">
              <TrendingDown size={16} />
              <span className="text-sm">{locale === "en" ? "Total expenses" : "إجمالي المصروفات"}</span>
            </div>
            <span className="number text-2xl font-bold text-red-600">{formatKWD(grandTotal.totalExpenses, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-emerald-600">
              <TrendingUp size={16} />
              <span className="text-sm">{locale === "en" ? "Net profit" : "صافي الربح"}</span>
            </div>
            <span className="number text-2xl font-bold text-emerald-600">{formatKWD(grandTotal.netRevenue, numberLocale)}</span>
          </div>
        </div>

        {vehicleStats.length > 0 && (
          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Vehicle comparison - net revenue" : "مقارنة المركبات - صافي الإيراد"}
            </h3>
            <div className="space-y-3">
              {[...vehicleStats].sort((a: VehicleStat, b: VehicleStat) => b.netRevenue - a.netRevenue).map((vehicle: VehicleStat) => (
                <div key={vehicle.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{locale === "en" ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}</span>
                    <span className="number font-bold text-emerald-600">{formatKWD(vehicle.netRevenue, numberLocale)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(vehicle.netRevenue / maxNet) * 100}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {locale === "en"
                      ? `${vehicle.operationDays} day(s) - daily average ${formatKWD(vehicle.avgDaily, numberLocale)}`
                      : `${vehicle.operationDays} يوم - متوسط يومي ${formatKWD(vehicle.avgDaily, numberLocale)}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Code" : "الكود"}</th>
                  <th>{locale === "en" ? "Vehicle" : "المركبة"}</th>
                  <th>{locale === "en" ? "Operation days" : "أيام التشغيل"}</th>
                  <th>{locale === "en" ? "Cash" : "نقدًا"}</th>
                  <th>KNET</th>
                  <th>{locale === "en" ? "Gross revenue" : "إجمالي الإيراد"}</th>
                  <th>{locale === "en" ? "Expenses" : "المصروفات"}</th>
                  <th>{locale === "en" ? "Net revenue" : "صافي الإيراد"}</th>
                  <th>{locale === "en" ? "Daily average" : "متوسط يومي"}</th>
                </tr>
              </thead>
              <tbody>
                {vehicleStats.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      {locale === "en" ? `No data for ${MONTHS.en[month - 1]} ${year}` : `لا توجد بيانات لشهر ${MONTHS.ar[month - 1]} ${year}`}
                    </td>
                  </tr>
                ) : (
                  vehicleStats.map((vehicle: VehicleStat) => (
                    <tr key={vehicle.id} className="hover:bg-muted/10">
                      <td className="font-mono text-sm">{vehicle.code}</td>
                      <td className="font-medium">
                        {locale === "en" ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}
                        {!vehicle.isActive && (
                          <span className="mr-1 text-xs text-muted-foreground">
                            {locale === "en" ? "(inactive)" : "(متوقف)"}
                          </span>
                        )}
                      </td>
                      <td className="number text-center">{vehicle.operationDays}</td>
                      <td className="number">{formatKWD(vehicle.totalCash, numberLocale)}</td>
                      <td className="number">{formatKWD(vehicle.totalKnet, numberLocale)}</td>
                      <td className="number font-medium">{formatKWD(vehicle.grossRevenue, numberLocale)}</td>
                      <td className="number text-red-600">{formatKWD(vehicle.totalExpenses, numberLocale)}</td>
                      <td className="number font-bold text-emerald-600">{formatKWD(vehicle.netRevenue, numberLocale)}</td>
                      <td className="number text-sm text-muted-foreground">{formatKWD(vehicle.avgDaily, numberLocale)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {vehicleStats.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td colSpan={2} className="py-2 text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="number text-center">{grandTotal.operationDays}</td>
                    <td className="number">{formatKWD(vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.totalCash, 0), numberLocale)}</td>
                    <td className="number">{formatKWD(vehicleStats.reduce((sum: number, vehicle: VehicleStat) => sum + vehicle.totalKnet, 0), numberLocale)}</td>
                    <td className="number">{formatKWD(grandTotal.grossRevenue, numberLocale)}</td>
                    <td className="number text-red-600">{formatKWD(grandTotal.totalExpenses, numberLocale)}</td>
                    <td className="number text-emerald-600">{formatKWD(grandTotal.netRevenue, numberLocale)}</td>
                    <td></td>
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
