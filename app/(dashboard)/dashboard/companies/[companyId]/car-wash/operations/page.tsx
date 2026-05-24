import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { DeleteOperationButton } from "./DeleteOperationButton";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ vehicleId?: string; month?: string; year?: string }>;
}

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

export default async function CarWashOperationsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const now = new Date();
  const year = Number.parseInt(sp.year ?? String(now.getFullYear()), 10);
  const month = Number.parseInt(sp.month ?? String(now.getMonth() + 1), 10);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const operations = await prisma.carWashDailyOperation.findMany({
    where: {
      companyId,
      date: { gte: startDate, lte: endDate },
      ...(sp.vehicleId ? { vehicleId: sp.vehicleId } : {}),
    },
    include: {
      vehicle: { select: { code: true, nameAr: true, nameEn: true } },
      location: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: { date: "desc" },
  });

  const vehicles = await prisma.carWashVehicle.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, nameAr: true, nameEn: true },
  });

  const totalCash = operations.reduce((sum, operation) => sum + Number(operation.totalCash), 0);
  const totalKnet = operations.reduce((sum, operation) => sum + Number(operation.totalKnet), 0);
  const totalRevenue = totalCash + totalKnet;
  const totalExpenses = operations.reduce((sum, operation) => sum + Number(operation.totalExpenses), 0);
  const netRevenue = operations.reduce((sum, operation) => sum + Number(operation.netRevenue), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Car Wash Operations" : "عمليات غسيل السيارات"}
        subtitle={`${MONTHS[locale][month - 1]} ${year}`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/operations/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New operation" : "عملية جديدة"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: locale === "en" ? "Total revenue" : "إجمالي الإيراد", value: totalRevenue, color: "text-green-600" },
            { label: locale === "en" ? "Cash" : "نقدي", value: totalCash, color: "text-blue-600" },
            { label: "KNET", value: totalKnet, color: "text-purple-600" },
            { label: locale === "en" ? "Net profit" : "صافي الربح", value: netRevenue, color: "text-emerald-600" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`number text-xl font-bold ${stat.color}`}>{formatKWD(stat.value, numberLocale)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/operations?month=${month}&year=${year}`}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${!sp.vehicleId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "All" : "الكل"}
          </Link>
          {vehicles.map((vehicle) => (
            <Link
              key={vehicle.id}
              href={`/dashboard/companies/${companyId}/car-wash/operations?vehicleId=${vehicle.id}&month=${month}&year=${year}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${sp.vehicleId === vehicle.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {vehicle.code} - {locale === "en" ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Vehicle" : "السيارة"}</th>
                  <th>{locale === "en" ? "Location" : "الموقع"}</th>
                  <th>{locale === "en" ? "Cash" : "نقدي"}</th>
                  <th>KNET</th>
                  <th>{locale === "en" ? "Expenses" : "مصروفات"}</th>
                  <th>{locale === "en" ? "Net" : "صافي"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {operations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No operations found this month" : "لا توجد عمليات في هذا الشهر"}
                    </td>
                  </tr>
                ) : (
                  operations.map((operation) => (
                    <tr key={operation.id} className="transition-colors hover:bg-muted/20">
                      <td className="text-sm">{formatDate(operation.date, numberLocale)}</td>
                      <td>
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">{operation.vehicle.code}</span>
                      </td>
                      <td className="text-sm">{locale === "en" ? operation.location.nameEn ?? operation.location.nameAr : operation.location.nameAr}</td>
                      <td className="number text-blue-600">{formatKWD(Number(operation.totalCash), numberLocale)}</td>
                      <td className="number text-purple-600">{formatKWD(Number(operation.totalKnet), numberLocale)}</td>
                      <td className="number text-red-600">{formatKWD(Number(operation.totalExpenses), numberLocale)}</td>
                      <td className="number font-bold text-green-600">{formatKWD(Number(operation.netRevenue), numberLocale)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            operation.status === "POSTED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {operation.status === "POSTED"
                            ? locale === "en"
                              ? "Posted"
                              : "مرحل"
                            : operation.status === "CLOSED"
                              ? locale === "en"
                                ? "Closed"
                                : "مغلق"
                              : locale === "en"
                                ? "Open"
                                : "مفتوح"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/companies/${companyId}/car-wash/operations/${operation.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {locale === "en" ? "View" : "عرض"}
                          </Link>
                          {session.isSuperAdmin && <DeleteOperationButton operationId={operation.id} locale={locale} />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {operations.length > 0 && (
                <tfoot className="border-t-2 bg-muted/20 font-bold">
                  <tr>
                    <td colSpan={3} className="text-center">
                      {locale === "en" ? "Total" : "الإجمالي"}
                    </td>
                    <td className="number text-blue-600">{formatKWD(totalCash, numberLocale)}</td>
                    <td className="number text-purple-600">{formatKWD(totalKnet, numberLocale)}</td>
                    <td className="number text-red-600">{formatKWD(totalExpenses, numberLocale)}</td>
                    <td className="number text-green-600">{formatKWD(netRevenue, numberLocale)}</td>
                    <td colSpan={2}></td>
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
