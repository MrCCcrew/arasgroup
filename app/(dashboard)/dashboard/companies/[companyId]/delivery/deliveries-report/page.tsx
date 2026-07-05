import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ contractId?: string; from?: string; to?: string; driverId?: string }>;
}

const AR = {
  kwd: "\u062f.\u0643",
  title: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0651\u0644\u0629",
  subtitle:
    "\u062a\u0648\u0635\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0648\u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u2014 \u0645\u0631\u062c\u0639 \u0644\u0644\u062a\u062d\u0627\u0633\u0628 \u0645\u0639 \u0627\u0644\u0639\u0642\u062f",
  pdf: "PDF",
  noContracts:
    "\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0642\u0648\u062f \u0645\u0641\u0639\u0651\u0644 \u0639\u0644\u064a\u0647\u0627 \u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0648\u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u0628\u0639\u062f.",
  contract: "\u0627\u0644\u0639\u0642\u062f",
  driver: "\u0627\u0644\u0633\u0627\u0626\u0642",
  allDrivers: "\u0643\u0644 \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  from: "\u0645\u0646",
  to: "\u0625\u0644\u0649",
  filter: "\u062a\u0635\u0641\u064a\u0629",
  clear: "\u0645\u0633\u062d",
  deliveriesCount: "\u0639\u062f\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u0627\u062a",
  total: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
  byDriver: "\u062d\u0633\u0628 \u0627\u0644\u0633\u0627\u0626\u0642",
  byRestaurant: "\u062d\u0633\u0628 \u0627\u0644\u0645\u0637\u0639\u0645",
  count: "\u0627\u0644\u0639\u062f\u062f",
  details: "\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  restaurant: "\u0627\u0644\u0645\u0637\u0639\u0645",
  location: "\u0627\u0644\u0645\u0643\u0627\u0646",
  price: "\u0627\u0644\u0633\u0639\u0631",
  noDeliveries: "\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0648\u0635\u064a\u0644\u0627\u062a",
  grandTotal: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0639\u0627\u0645",
} as const;

export default async function DeliveriesReportPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const kwd = en ? "KWD" : AR.kwd;
  const money = (n: number) => `${n.toLocaleString(numberLocale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${kwd}`;

  const contracts = await prisma.deliveryContract.findMany({
    where: { companyId, usesLocationPricing: true },
    select: { id: true, nameAr: true, nameEn: true },
    orderBy: { nameAr: "asc" },
  });

  const contractId = sp.contractId || contracts[0]?.id || "";
  const fromDate = sp.from ? new Date(`${sp.from}T00:00:00.000`) : undefined;
  const toDate = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;

  const driverRows = await prisma.driver.findMany({
    where: { employee: { companyId, isDeleted: false } },
    include: { employee: { select: { nameAr: true, nameEn: true } } },
    orderBy: { employee: { nameAr: "asc" } },
  });

  const driverName = (d: { employee: { nameAr: string; nameEn: string | null } }) =>
    en ? d.employee.nameEn ?? d.employee.nameAr : d.employee.nameAr;

  const deliveries = contractId
    ? await prisma.deliveryOrderDelivery.findMany({
        where: {
          contractId,
          ...(sp.driverId ? { driverId: sp.driverId } : {}),
          ...(fromDate || toDate
            ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
            : {}),
        },
        include: {
          restaurant: { select: { nameAr: true } },
          location: { select: { nameAr: true } },
          driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "asc" }],
      })
    : [];
  type DeliveryReportRow = typeof deliveries[number];
  type DeliveryDriverRow = typeof driverRows[number];
  type DeliveryContractRow = typeof contracts[number];

  const grandTotal = deliveries.reduce((sum: number, delivery: DeliveryReportRow) => sum + Number(delivery.price) * delivery.count, 0);
  const totalOrders = deliveries.reduce((sum: number, delivery: DeliveryReportRow) => sum + delivery.count, 0);

  // count = عدد الطلبات (مجموع counts)، total = العدد × السعر
  const byDriver = new Map<string, { name: string; count: number; total: number }>();
  const byRestaurant = new Map<string, { name: string; count: number; total: number }>();
  for (const delivery of deliveries) {
    const lineTotal = Number(delivery.price) * delivery.count;
    const deliveryDriverName = en ? delivery.driver.employee.nameEn ?? delivery.driver.employee.nameAr : delivery.driver.employee.nameAr;
    const driverRow = byDriver.get(delivery.driverId) ?? { name: deliveryDriverName, count: 0, total: 0 };
    driverRow.count += delivery.count;
    driverRow.total += lineTotal;
    byDriver.set(delivery.driverId, driverRow);

    const restaurantRow = byRestaurant.get(delivery.restaurantId) ?? { name: delivery.restaurant.nameAr, count: 0, total: 0 };
    restaurantRow.count += delivery.count;
    restaurantRow.total += lineTotal;
    byRestaurant.set(delivery.restaurantId, restaurantRow);
  }

  const qs = (extra: Record<string, string>) => {
    const query = new URLSearchParams({
      ...(contractId ? { contractId } : {}),
      ...(sp.from ? { from: sp.from } : {}),
      ...(sp.to ? { to: sp.to } : {}),
      ...(sp.driverId ? { driverId: sp.driverId } : {}),
      ...extra,
    });
    return query.toString();
  };

  return (
    <div>
      <Header
        title={en ? "Recorded deliveries (settlement)" : AR.title}
        subtitle={en ? "Restaurants & locations deliveries — reference for settling with the contract" : AR.subtitle}
        companyId={companyId}
        actions={
          contractId ? (
            <a
              href={`/dashboard/companies/${companyId}/delivery/deliveries-report/print?${qs({})}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              <FileDown size={16} />
              {AR.pdf}
            </a>
          ) : null
        }
      />

      <div className="page-container space-y-4">
        {contracts.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
            {en ? "No contracts use the restaurants & locations model yet." : AR.noContracts}
          </p>
        ) : (
          <>
            <form method="GET" className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{en ? "Contract" : AR.contract}</label>
                <select name="contractId" defaultValue={contractId} className="input-field w-full sm:w-56">
                  {contracts.map((contract: DeliveryContractRow) => (
                    <option key={contract.id} value={contract.id}>
                      {en ? contract.nameEn ?? contract.nameAr : contract.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{en ? "Driver" : AR.driver}</label>
                <select name="driverId" defaultValue={sp.driverId ?? ""} className="input-field w-full sm:w-56">
                  <option value="">{en ? "All drivers" : AR.allDrivers}</option>
                  {driverRows.map((driver: DeliveryDriverRow) => (
                    <option key={driver.id} value={driver.id}>
                      {driverName(driver)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{en ? "From" : AR.from}</label>
                <input type="date" name="from" defaultValue={sp.from ?? ""} className="input-field" dir="ltr" />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">{en ? "To" : AR.to}</label>
                <input type="date" name="to" defaultValue={sp.to ?? ""} className="input-field" dir="ltr" />
              </div>

              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {en ? "Filter" : AR.filter}
              </button>

              {(sp.driverId || sp.from || sp.to) && (
                <a
                  href={`/dashboard/companies/${companyId}/delivery/deliveries-report?${qs({ driverId: "", from: "", to: "" })}`}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                >
                  {en ? "Clear" : AR.clear}
                </a>
              )}
            </form>

            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <div>
                  <p className="number text-2xl font-bold">{totalOrders}</p>
                  <p className="text-xs text-muted-foreground">{en ? "Orders" : "عدد الطلبات"}</p>
                </div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="number text-2xl font-bold text-blue-600">{money(grandTotal)}</p>
                  <p className="text-xs text-muted-foreground">{en ? "Total" : AR.total}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-xl border bg-card">
                <p className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">{en ? "By driver" : AR.byDriver}</p>
                <table className="ar-table text-sm">
                  <thead>
                    <tr>
                      <th>{en ? "Driver" : AR.driver}</th>
                      <th className="text-center">{en ? "Count" : AR.count}</th>
                      <th className="text-end">{en ? "Total" : AR.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDriver.size === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">—</td>
                      </tr>
                    ) : (
                      [...byDriver.values()].sort((a: { name: string; count: number; total: number }, b: { name: string; count: number; total: number }) => b.total - a.total).map((row: { name: string; count: number; total: number }) => (
                        <tr key={row.name}>
                          <td className="font-medium">{row.name}</td>
                          <td className="number text-center">{row.count}</td>
                          <td className="number text-end font-bold text-blue-600">{money(row.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                <p className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">{en ? "By restaurant" : AR.byRestaurant}</p>
                <table className="ar-table text-sm">
                  <thead>
                    <tr>
                      <th>{en ? "Restaurant" : AR.restaurant}</th>
                      <th className="text-center">{en ? "Count" : AR.count}</th>
                      <th className="text-end">{en ? "Total" : AR.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRestaurant.size === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">—</td>
                      </tr>
                    ) : (
                      [...byRestaurant.values()].sort((a: { name: string; count: number; total: number }, b: { name: string; count: number; total: number }) => b.total - a.total).map((row: { name: string; count: number; total: number }) => (
                        <tr key={row.name}>
                          <td className="font-medium">{row.name}</td>
                          <td className="number text-center">{row.count}</td>
                          <td className="number text-end font-bold text-blue-600">{money(row.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <p className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">{en ? "Details" : AR.details}</p>
              <div className="overflow-x-auto">
                <table className="ar-table text-sm">
                  <thead>
                    <tr>
                      <th>{en ? "Date" : AR.date}</th>
                      <th>{en ? "Driver" : AR.driver}</th>
                      <th>{en ? "Restaurant" : AR.restaurant}</th>
                      <th>{en ? "Location" : AR.location}</th>
                      <th className="text-center">{en ? "Orders" : "عدد الطلبات"}</th>
                      <th className="text-center">{en ? "Unit price" : "سعر الوحدة"}</th>
                      <th className="text-end">{en ? "Total" : AR.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          {en ? "No deliveries found" : AR.noDeliveries}
                        </td>
                      </tr>
                    ) : (
                      deliveries.map((delivery: DeliveryReportRow) => (
                        <tr key={delivery.id} className="hover:bg-muted/30">
                          <td className="text-sm">{formatDate(delivery.date, numberLocale)}</td>
                          <td className="font-medium">{en ? delivery.driver.employee.nameEn ?? delivery.driver.employee.nameAr : delivery.driver.employee.nameAr}</td>
                          <td>{delivery.restaurant.nameAr}</td>
                          <td>{delivery.location.nameAr}</td>
                          <td className="number text-center">{delivery.count}</td>
                          <td className="number text-center">{money(Number(delivery.price))}</td>
                          <td className="number text-end font-bold text-blue-600">{money(Number(delivery.price) * delivery.count)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {deliveries.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-bold">
                        <td colSpan={4} className="text-end">{en ? "Grand total" : AR.grandTotal}</td>
                        <td className="number text-center">{totalOrders}</td>
                        <td></td>
                        <td className="number text-end text-blue-600">{money(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
