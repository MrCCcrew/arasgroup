import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { DeleteOperationButton } from "./DeleteOperationButton";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ vehicleId?: string; month?: string; year?: string; fromDate?: string; toDate?: string }>;
}

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

const KUWAIT_OFFSET = "+03:00";

function parseKuwaitCalendarDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${KUWAIT_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function kuwaitDateParam(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuwait", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

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

  const fromDate = parseKuwaitCalendarDate(sp.fromDate);
  const toDate = parseKuwaitCalendarDate(sp.toDate, true);
  const hasDateRange = Boolean(fromDate || toDate);
  const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
  const monthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = parseKuwaitCalendarDate(`${year}-${String(month).padStart(2, "0")}-01`)!;
  const monthEnd = parseKuwaitCalendarDate(`${year}-${String(month).padStart(2, "0")}-${String(monthLastDay).padStart(2, "0")}`, true)!;
  const dateFilter = hasDateRange ? { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } : { gte: monthStart, lte: monthEnd };
  const operationsHref = (overrides: { vehicleId?: string; fromDate?: string; toDate?: string } = {}) => {
    const query = new URLSearchParams();
    const vehicleId = overrides.vehicleId === undefined ? sp.vehicleId : overrides.vehicleId;
    const selectedFrom = overrides.fromDate === undefined ? sp.fromDate : overrides.fromDate;
    const selectedTo = overrides.toDate === undefined ? sp.toDate : overrides.toDate;
    if (vehicleId) query.set("vehicleId", vehicleId);
    if (selectedFrom) query.set("fromDate", selectedFrom);
    if (selectedTo) query.set("toDate", selectedTo);
    if (!selectedFrom && !selectedTo) { query.set("month", String(month)); query.set("year", String(year)); }
    return `/dashboard/companies/${companyId}/car-wash/operations?${query.toString()}`;
  };
  const today = kuwaitDateParam(now);
  const weekStartDate = new Date(`${today}T12:00:00${KUWAIT_OFFSET}`);
  weekStartDate.setDate(weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7));
  const weekStart = kuwaitDateParam(weekStartDate);

  const operations = await prisma.carWashDailyOperation.findMany({
    where: {
      companyId,
      date: dateFilter,
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

  type CarWashOperationItem = typeof operations[number];
  type CarWashVehicleItem = typeof vehicles[number];
  const totalCash = operations.reduce((sum: number, operation: CarWashOperationItem) => sum + Number(operation.totalCash), 0);
  const totalKnet = operations.reduce((sum: number, operation: CarWashOperationItem) => sum + Number(operation.totalKnet), 0);
  const totalRevenue = totalCash + totalKnet;
  const totalExpenses = operations.reduce((sum: number, operation: CarWashOperationItem) => sum + Number(operation.totalExpenses), 0);
  const netRevenue = operations.reduce((sum: number, operation: CarWashOperationItem) => sum + Number(operation.netRevenue), 0);

  const canDelete = hasPermission(session, "CAR_WASH_OPERATIONS", "DELETE", { companyId });

  return (
    <div>
      <Header
        title={locale === "en" ? "Car Wash Operations" : "عمليات غسيل السيارات"}
        subtitle={hasDateRange ? `${sp.fromDate ?? "…"} — ${sp.toDate ?? "…"}` : `${MONTHS[locale][month - 1]} ${year}`}
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
          ].map((stat: { label: string; value: number; color: string }) => (
            <div key={stat.label} className="stat-card">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`number text-xl font-bold ${stat.color}`}>{formatKWD(stat.value, numberLocale)}</p>
            </div>
          ))}
        </div>

        <form method="GET" className="rounded-xl border bg-card p-4">
          <input type="hidden" name="year" value={year} />
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">{locale === "en" ? "Month" : "الشهر"}</span><select name="month" defaultValue={String(month)} className="input-field w-full">{MONTHS[locale].map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">{locale === "en" ? "From date" : "من تاريخ"}</span><input name="fromDate" type="date" defaultValue={sp.fromDate} className="input-field w-full" dir="ltr" /></label>
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">{locale === "en" ? "To date" : "إلى تاريخ"}</span><input name="toDate" type="date" defaultValue={sp.toDate} className="input-field w-full" dir="ltr" /></label>
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">{locale === "en" ? "Vehicle" : "السيارة"}</span><select name="vehicleId" defaultValue={sp.vehicleId ?? ""} className="input-field w-full"><option value="">{locale === "en" ? "All vehicles" : "كل السيارات"}</option>{vehicles.map((vehicle: CarWashVehicleItem) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} — {locale === "en" ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}</option>)}</select></label>
            <div className="flex items-end gap-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{locale === "en" ? "Apply" : "تطبيق"}</button><Link href={`/dashboard/companies/${companyId}/car-wash/operations`} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">{locale === "en" ? "Clear" : "مسح"}</Link></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href={operationsHref({ fromDate: today, toDate: today })} className="rounded-full border px-3 py-1 hover:bg-muted">{locale === "en" ? "Today" : "اليوم"}</Link>
            <Link href={operationsHref({ fromDate: weekStart, toDate: today })} className="rounded-full border px-3 py-1 hover:bg-muted">{locale === "en" ? "This week" : "هذا الأسبوع"}</Link>
            <Link href={`/dashboard/companies/${companyId}/car-wash/operations?month=${month}&year=${year}${sp.vehicleId ? `&vehicleId=${sp.vehicleId}` : ""}`} className="rounded-full border px-3 py-1 hover:bg-muted">{locale === "en" ? "This month" : "هذا الشهر"}</Link>
          </div>
          {invalidDateRange && <p className="mt-3 text-sm text-destructive">{locale === "en" ? "From date must be before or equal to To date." : "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له."}</p>}
        </form>

        <div className="flex flex-wrap gap-2">
          <Link
            href={operationsHref({ vehicleId: "" })}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${!sp.vehicleId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {locale === "en" ? "All" : "الكل"}
          </Link>
          {vehicles.map((vehicle: CarWashVehicleItem) => (
            <Link
              key={vehicle.id}
              href={operationsHref({ vehicleId: vehicle.id })}
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
                      {hasDateRange ? (locale === "en" ? "No operations found for the selected period" : "لا توجد عمليات في الفترة المحددة") : (locale === "en" ? "No operations found this month" : "لا توجد عمليات في هذا الشهر")}
                    </td>
                  </tr>
                ) : (
                  operations.map((operation: CarWashOperationItem) => (
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
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-primary hover:bg-muted"
                          >
                            <Eye size={13} />
                            {locale === "en" ? "View invoices" : "عرض الفواتير"}
                          </Link>
                          <Link
                            href={`/dashboard/companies/${companyId}/car-wash/operations/${operation.id}/edit`}
                            className="text-xs text-primary hover:underline"
                          >
                            {locale === "en" ? "Edit" : "تعديل"}
                          </Link>
                          {canDelete && <DeleteOperationButton operationId={operation.id} locale={locale} />}
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
