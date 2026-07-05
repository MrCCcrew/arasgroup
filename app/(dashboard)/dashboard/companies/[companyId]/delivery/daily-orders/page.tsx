import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { DistributeOrders } from "./DistributeOrders";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ page?: string; contractId?: string; driverId?: string; workStatus?: string; month?: string; year?: string }>;
}

const AR = {
  worked: "\u0639\u0645\u0644",
  onLeave: "\u0625\u062c\u0627\u0632\u0629",
  vehicleBreakdown: "\u0639\u0637\u0644 \u0633\u064a\u0627\u0631\u0629",
  noShifts: "\u0628\u062f\u0648\u0646 \u0634\u064a\u0641\u062a\u0627\u062a",
  missedShift: "\u0639\u0646\u062f\u0647 \u0634\u064a\u0641\u062a \u0648\u0644\u0645 \u064a\u0639\u0645\u0644",
  lateLogin: "\u062a\u0623\u062e\u0631 \u0641\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
  absent: "\u063a\u064a\u0627\u0628",
  kwd: "\u062f.\u0643",
  title: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629",
  subtitle: "\u0633\u062c\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0644\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  printReport: "\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631",
  shortDetailedReport: "\u062a\u0642\u0631\u064a\u0631 \u062a\u0641\u0635\u064a\u0644\u064a \u0645\u062e\u062a\u0635\u0631",
  newEntry: "\u062a\u0633\u062c\u064a\u0644 \u064a\u0648\u0645\u064a",
  totalRecords: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u062c\u0644\u0627\u062a",
  totalOrders: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  all: "\u0627\u0644\u0643\u0644",
  allDrivers: "\u0643\u0644 \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  inactive: "\u063a\u064a\u0631 \u0646\u0634\u0637",
  filter: "\u062a\u0635\u0641\u064a\u0629",
  clear: "\u0645\u0633\u062d",
  allStatuses: "\u0643\u0644 \u0627\u0644\u062d\u0627\u0644\u0627\u062a",
  walletBalance: "\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u062d\u0627\u0644\u064a \u0641\u064a \u0645\u062d\u0641\u0638\u0629 \u0627\u0644\u0633\u0627\u0626\u0642",
  totalCollected: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062d\u0635\u0644",
  totalInvoices: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631",
  netBalance: "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0635\u064a\u062f",
  selectMonth: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0634\u0647\u0631",
  selectYear: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0646\u0629",
  allMonths: "\u0643\u0644 \u0627\u0644\u0634\u0647\u0648\u0631",
  january: "\u064a\u0646\u0627\u064a\u0631",
  february: "\u0641\u0628\u0631\u0627\u064a\u0631",
  march: "\u0645\u0627\u0631\u0633",
  april: "\u0623\u0628\u0631\u064a\u0644",
  may: "\u0645\u0627\u064a\u0648",
  june: "\u064a\u0648\u0646\u064a\u0648",
  july: "\u064a\u0648\u0644\u064a\u0648",
  august: "\u0623\u063a\u0633\u0637\u0633",
  september: "\u0633\u0628\u062a\u0645\u0628\u0631",
  october: "\u0623\u0643\u062a\u0648\u0628\u0631",
  november: "\u0646\u0648\u0641\u0645\u0628\u0631",
  december: "\u062f\u064a\u0633\u0645\u0628\u0631",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  driver: "\u0627\u0644\u0633\u0627\u0626\u0642",
  status: "\u0627\u0644\u062d\u0627\u0644\u0629",
  contract: "\u0627\u0644\u0639\u0642\u062f",
  ordersCount: "\u0639\u062f\u062f \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  collected: "\u0627\u0644\u0645\u062d\u0635\u0644",
  rating: "\u0627\u0644\u062a\u0642\u064a\u064a\u0645",
  noRecords: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a",
  workedUnder: "\u0639\u0645\u0644 \u0628\u0627\u0633\u0645:",
  deleteFor: "\u062d\u0630\u0641 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0644\u0644\u0633\u0627\u0626\u0642",
} as const;

const WORK_STATUS_LABELS = {
  ar: {
    WORKED: AR.worked,
    ON_LEAVE: AR.onLeave,
    VEHICLE_BREAKDOWN: AR.vehicleBreakdown,
    NO_SHIFTS: AR.noShifts,
    MISSED_SHIFT: AR.missedShift,
    LATE_LOGIN: AR.lateLogin,
    ABSENT: AR.absent,
  },
  en: {
    WORKED: "Worked",
    ON_LEAVE: "On leave",
    VEHICLE_BREAKDOWN: "Vehicle breakdown",
    NO_SHIFTS: "No shifts",
    MISSED_SHIFT: "Missed shift",
    LATE_LOGIN: "Late login",
    ABSENT: "Absent",
  },
} as const;

type WorkStatus = keyof typeof WORK_STATUS_LABELS.ar;

function buildHref(companyId: string, params: { page?: string; contractId?: string; driverId?: string; workStatus?: string; month?: string; year?: string }) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.contractId) query.set("contractId", params.contractId);
  if (params.driverId) query.set("driverId", params.driverId);
  if (params.workStatus) query.set("workStatus", params.workStatus);
  if (params.month) query.set("month", params.month);
  if (params.year) query.set("year", params.year);
  const qs = query.toString();
  return `/dashboard/companies/${companyId}/delivery/daily-orders${qs ? `?${qs}` : ""}`;
}

export default async function DailyOrdersPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const page = Number.parseInt(sp.page ?? "1", 10);
  const pageSize = 25;

  // Default to current month/year if not specified
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());
  const effectiveMonth = sp.month ?? currentMonth;
  const effectiveYear = sp.year ?? currentYear;

  const contracts = await prisma.deliveryContract.findMany({
    where: { companyId, isActive: true },
    orderBy: { nameAr: "asc" },
  });

  // Date filtering by month/year (default to current month/year)
  let dateFilter = {};
  if (effectiveMonth && effectiveYear) {
    const monthNum = Number.parseInt(effectiveMonth, 10);
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    dateFilter = { date: { gte: startDate, lte: endDate } };
  } else if (effectiveYear) {
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
    dateFilter = { date: { gte: startDate, lte: endDate } };
  }

  const where = {
    companyId,
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus as WorkStatus } : {}),
    ...dateFilter,
  };

  const [total, orders, driverRows] = await Promise.all([
    prisma.deliveryDailyOrder.count({ where }),
    prisma.deliveryDailyOrder.findMany({
      where,
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        operatedAsDriver: { include: { employee: { select: { nameAr: true, nameEn: true, isActive: true } } } },
        contract: { select: { nameAr: true, nameEn: true, platform: true } },
        allocations: {
          include: { driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } } },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.driver.findMany({
      where: { employee: { companyId, isDeleted: false } },
      include: { employee: { select: { nameAr: true, nameEn: true, isActive: true } } },
      orderBy: { employee: { nameAr: "asc" } },
    }),
  ]);

  type DailyOrderItem = typeof orders[number];
  type DriverRowItem = typeof driverRows[number];
  type DriverOption = { id: string; name: string; isActive: boolean };

  const driverOptions = driverRows.map((driver: DriverRowItem): DriverOption => ({
    id: driver.id,
    name: locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr,
    isActive: driver.employee.isActive,
  }));

  // Get all filtered orders (no pagination) to calculate total collection
  const allFilteredOrders = await prisma.deliveryDailyOrder.findMany({
    where,
    select: { id: true, driverId: true, contractId: true, date: true },
  });

  const allDriverIds = [...new Set(allFilteredOrders.map((order: typeof allFilteredOrders[number]) => order.driverId))];
  const charges =
    allDriverIds.length > 0
      ? await prisma.driverWalletTransaction.findMany({
          where: { type: "CHARGE", driverId: { in: allDriverIds } },
          select: { dailyOrderId: true, driverId: true, contractId: true, date: true, amount: true },
        })
      : [];

  const chargeByOrder = new Map<string, number>();
  const chargeByKey = new Map<string, number>();
  for (const charge of charges) {
    const amount = Number(charge.amount);
    if (charge.dailyOrderId) {
      chargeByOrder.set(charge.dailyOrderId, (chargeByOrder.get(charge.dailyOrderId) ?? 0) + amount);
    }
    const key = `${charge.driverId}|${charge.contractId ?? ""}|${charge.date.toISOString().slice(0, 10)}`;
    chargeByKey.set(key, (chargeByKey.get(key) ?? 0) + amount);
  }

  const orderCollection = (order: { id: string; driverId: string; contractId: string; date: Date }) =>
    chargeByOrder.get(order.id) ?? chargeByKey.get(`${order.driverId}|${order.contractId}|${order.date.toISOString().slice(0, 10)}`) ?? null;

  // Calculate total collection for all filtered orders
  let totalCollectionAmount = 0;
  for (const order of allFilteredOrders) {
    const collection = orderCollection(order) ?? 0;
    totalCollectionAmount += collection;
  }

  const selectedDriver = sp.driverId ? driverRows.find((driver: DriverRowItem) => driver.id === sp.driverId) : null;
  const statsDriverRows = selectedDriver
    ? [selectedDriver]
    : driverRows.filter((driver: DriverRowItem) => allDriverIds.includes(driver.id));
  const totalWalletBalance = statsDriverRows.reduce((sum: number, driver: DriverRowItem) => sum + Number(driver.walletBalance), 0);

  // Build invoice date filter matching the orders filter
  let invoiceDateFilter = {};
  if (effectiveMonth && effectiveYear) {
    const monthNum = Number.parseInt(effectiveMonth, 10);
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    invoiceDateFilter = { invoiceDate: { gte: startDate, lte: endDate } };
  } else if (effectiveYear) {
    const yearNum = Number.parseInt(effectiveYear, 10);
    const startDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
    invoiceDateFilter = { invoiceDate: { gte: startDate, lte: endDate } };
  }

  const totalInvoicesAmount =
    statsDriverRows.length > 0
      ? await prisma.deliveryInvoice.aggregate({
          where: {
            targetType: "DRIVER",
            driverId: { in: statsDriverRows.map((driver: DriverRowItem) => driver.id) },
            deletedAt: null,
            ...invoiceDateFilter,
          },
          _sum: { amount: true },
        })
      : null;
  const driverInvoicesTotal = totalInvoicesAmount?._sum.amount ? Number(totalInvoicesAmount._sum.amount) : 0;

  // Calculate net balance (Current Balance - Invoices)
  const netBalance = totalWalletBalance - driverInvoicesTotal;

  const totalPages = Math.ceil(total / pageSize);
  const totalOrders = await prisma.deliveryDailyOrder.aggregate({ where, _sum: { ordersCount: true } });
  const kwd = locale === "en" ? "KWD" : AR.kwd;

  const printQuery = new URLSearchParams({
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.workStatus ? { workStatus: sp.workStatus } : {}),
    month: effectiveMonth,
    year: effectiveYear,
  }).toString();
  const printHref = `/dashboard/companies/${companyId}/delivery/daily-orders/print${printQuery ? `?${printQuery}` : ""}`;
  const summaryHref = `/dashboard/companies/${companyId}/delivery/daily-orders/summary-report${printQuery ? `?${printQuery}` : ""}`;

  const canUpdate = hasPermission(session, "DELIVERY_OPERATIONS", "UPDATE", { companyId });
  const canDelete = hasPermission(session, "DELIVERY_OPERATIONS", "DELETE", { companyId });

  return (
    <div>
      <Header
        title={locale === "en" ? "Daily Orders" : AR.title}
        subtitle={locale === "en" ? "Daily order log for drivers" : AR.subtitle}
        companyId={companyId}
        actions={
          <>
            <Link href={printHref} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Print report" : AR.printReport}
            </Link>
            <Link href={summaryHref} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Short detailed report" : AR.shortDetailedReport}
            </Link>
            <Link
              href={`/dashboard/companies/${companyId}/delivery/daily-orders/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New daily entry" : AR.newEntry}
            </Link>
          </>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Total records" : AR.totalRecords}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="number text-2xl font-bold">{totalOrders._sum.ordersCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Total orders" : AR.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref(companyId, { driverId: sp.driverId, workStatus: sp.workStatus, month: sp.month, year: sp.year })}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !sp.contractId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
            }`}
          >
            {locale === "en" ? "All" : AR.all}
          </Link>
          {contracts.map((contract: typeof contracts[number]) => (
            <Link
              key={contract.id}
              href={buildHref(companyId, { contractId: contract.id, driverId: sp.driverId, workStatus: sp.workStatus, month: sp.month, year: sp.year })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                sp.contractId === contract.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              }`}
            >
              {locale === "en" ? contract.nameEn ?? contract.nameAr : contract.nameAr}
            </Link>
          ))}
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-2">
          {sp.contractId && <input type="hidden" name="contractId" value={sp.contractId} />}
          {sp.workStatus && <input type="hidden" name="workStatus" value={sp.workStatus} />}

          <select name="year" defaultValue={effectiveYear} className="input-field w-32">
            <option value="">{locale === "en" ? "All years" : AR.selectYear}</option>
            {Array.from({ length: 5 }, (_: unknown, i: number) => new Date().getFullYear() - i).map((year: number) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select name="month" defaultValue={effectiveMonth} className="input-field w-32">
            <option value="">{locale === "en" ? "All months" : AR.allMonths}</option>
            <option value="1">{locale === "en" ? "January" : AR.january}</option>
            <option value="2">{locale === "en" ? "February" : AR.february}</option>
            <option value="3">{locale === "en" ? "March" : AR.march}</option>
            <option value="4">{locale === "en" ? "April" : AR.april}</option>
            <option value="5">{locale === "en" ? "May" : AR.may}</option>
            <option value="6">{locale === "en" ? "June" : AR.june}</option>
            <option value="7">{locale === "en" ? "July" : AR.july}</option>
            <option value="8">{locale === "en" ? "August" : AR.august}</option>
            <option value="9">{locale === "en" ? "September" : AR.september}</option>
            <option value="10">{locale === "en" ? "October" : AR.october}</option>
            <option value="11">{locale === "en" ? "November" : AR.november}</option>
            <option value="12">{locale === "en" ? "December" : AR.december}</option>
          </select>

          <select name="driverId" defaultValue={sp.driverId ?? ""} className="input-field w-full sm:w-80">
            <option value="">{locale === "en" ? "All drivers" : AR.allDrivers}</option>
            {driverOptions.map((driver: DriverOption) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
                {driver.isActive ? "" : locale === "en" ? " (Inactive)" : ` (${AR.inactive})`}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {locale === "en" ? "Filter" : AR.filter}
          </button>
          {(sp.driverId || sp.contractId || sp.workStatus || sp.month || sp.year) && (
            <Link href={buildHref(companyId, {})} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              {locale === "en" ? "Clear" : AR.clear}
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {(["", "WORKED", "ON_LEAVE", "VEHICLE_BREAKDOWN", "NO_SHIFTS", "MISSED_SHIFT", "LATE_LOGIN", "ABSENT"] as const).map((status: "" | WorkStatus) => (
            <Link
              key={status || "all-statuses"}
              href={buildHref(companyId, { contractId: sp.contractId, driverId: sp.driverId, workStatus: status || undefined, month: sp.month, year: sp.year })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                (sp.workStatus ?? "") === status ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
              }`}
            >
              {status ? WORK_STATUS_LABELS[locale][status] : locale === "en" ? "All statuses" : AR.allStatuses}
            </Link>
          ))}
        </div>

        {(selectedDriver || statsDriverRows.length > 0) && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-blue-50/60 p-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Driver's current wallet balance" : AR.walletBalance}
              </p>
              <p className={`number text-2xl font-bold ${totalWalletBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {totalWalletBalance.toFixed(3)} {kwd}
              </p>
            </div>
            <div className="border-r pr-4 rtl:border-l rtl:border-r-0 rtl:pl-4 rtl:pr-0">
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Total collected" : AR.totalCollected}
              </p>
              <p className="number text-2xl font-bold text-blue-600">{totalCollectionAmount.toFixed(3)} {kwd}</p>
            </div>
            <div className="border-r pr-4 rtl:border-l rtl:border-r-0 rtl:pl-4 rtl:pr-0">
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Total invoices" : AR.totalInvoices}
              </p>
              <p className="number text-2xl font-bold text-purple-600">{driverInvoicesTotal.toFixed(3)} {kwd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Net balance" : AR.netBalance}
              </p>
              <p className={`number text-2xl font-bold ${netBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {netBalance.toFixed(3)} {kwd}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : AR.date}</th>
                  <th>{locale === "en" ? "Driver" : AR.driver}</th>
                  <th>{locale === "en" ? "Status" : AR.status}</th>
                  <th>{locale === "en" ? "Contract" : AR.contract}</th>
                  <th>{locale === "en" ? "Orders count" : AR.ordersCount}</th>
                  <th>{locale === "en" ? "Collected" : AR.collected}</th>
                  <th>{locale === "en" ? "Rating" : AR.rating}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No records found" : AR.noRecords}
                    </td>
                  </tr>
                ) : (
                  orders.map((order: DailyOrderItem) => (
                    <tr key={order.id} className="hover:bg-muted/30">
                      <td className="text-sm">{formatDate(order.date, numberLocale)}</td>
                      <td className="font-medium">
                        {locale === "en" ? order.driver.employee.nameEn ?? order.driver.employee.nameAr : order.driver.employee.nameAr}
                        {order.operatedAsDriver && (
                          <p className="mt-1 text-xs font-normal text-amber-700">
                            {locale === "en" ? "Worked under:" : AR.workedUnder}{" "}
                            {locale === "en"
                              ? order.operatedAsDriver.employee.nameEn ?? order.operatedAsDriver.employee.nameAr
                              : order.operatedAsDriver.employee.nameAr}
                            {!order.operatedAsDriver.employee.isActive && (
                              <span className="mr-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                {locale === "en" ? "Inactive" : AR.inactive}
                              </span>
                            )}
                          </p>
                        )}
                        {order.allocations.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {order.allocations.map((allocation: DailyOrderItem["allocations"][number]) => (
                              <p key={allocation.id} className="text-xs font-normal text-emerald-600">
                                {"\u21b3"} {locale === "en" ? allocation.driver.employee.nameEn ?? allocation.driver.employee.nameAr : allocation.driver.employee.nameAr}:{" "}
                                {allocation.allocatedOrders}
                                {allocation.walletAmount != null && Number(allocation.walletAmount) > 0 && (
                                  <span className="text-blue-600"> {"\u2022"} {Number(allocation.walletAmount).toFixed(3)} {kwd}</span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-center text-sm">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {WORK_STATUS_LABELS[locale][order.workStatus as WorkStatus]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            order.contract.platform === "TALABAT"
                              ? "bg-orange-50 text-orange-700"
                              : order.contract.platform === "RO_POPS"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {locale === "en" ? order.contract.nameEn ?? order.contract.nameAr : order.contract.nameAr}
                        </span>
                      </td>
                      <td className="number text-center font-bold">{order.ordersCount}</td>
                      <td className="number text-center text-sm">
                        {(() => {
                          const collection = orderCollection(order);
                          return collection != null ? (
                            <span className="font-medium text-blue-600">{collection.toFixed(3)} {kwd}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          );
                        })()}
                      </td>
                      <td className="text-center text-sm">{order.rating ? Number(order.rating).toFixed(1) : "-"}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canUpdate && (
                            <DistributeOrders
                              orderId={order.id}
                              ordersCount={order.ordersCount}
                              originalDriverName={locale === "en" ? order.driver.employee.nameEn ?? order.driver.employee.nameAr : order.driver.employee.nameAr}
                              drivers={driverOptions.filter((driver: DriverOption) => driver.isActive).map((driver: DriverOption) => ({ id: driver.id, name: driver.name }))}
                              initial={order.allocations.map((allocation: DailyOrderItem["allocations"][number]) => ({
                                driverId: allocation.driverId,
                                allocatedOrders: allocation.allocatedOrders,
                                walletAmount: allocation.walletAmount != null ? Number(allocation.walletAmount) : null,
                                notes: allocation.notes,
                              }))}
                              en={locale === "en"}
                            />
                          )}
                          {canUpdate && (
                            <Link
                              href={`/dashboard/companies/${companyId}/delivery/daily-orders/${order.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil size={13} />
                            </Link>
                          )}
                          {canDelete && (
                            <DeleteConfirmButton
                              apiUrl={`/api/delivery/daily-orders/${order.id}`}
                              confirmMessage={`${locale === "en" ? "Delete daily order for" : AR.deleteFor} ${order.driver.employee.nameAr} ${formatDate(order.date, numberLocale)}?`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_: unknown, index: number) => index + 1).map((currentPage: number) => (
              <Link
                key={currentPage}
                href={buildHref(companyId, {
                  page: String(currentPage),
                  contractId: sp.contractId,
                  driverId: sp.driverId,
                  workStatus: sp.workStatus,
                  month: sp.month,
                  year: sp.year,
                })}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  currentPage === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {currentPage}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
