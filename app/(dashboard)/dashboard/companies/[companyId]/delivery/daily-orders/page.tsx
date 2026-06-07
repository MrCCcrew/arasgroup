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
  searchParams: Promise<{ page?: string; contractId?: string }>;
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

  const contracts = await prisma.deliveryContract.findMany({
    where: { companyId, isActive: true },
    orderBy: { nameAr: "asc" },
  });

  const where = {
    companyId,
    ...(sp.contractId ? { contractId: sp.contractId } : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.deliveryDailyOrder.count({ where }),
    prisma.deliveryDailyOrder.findMany({
      where,
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        contract: { select: { nameAr: true, nameEn: true, platform: true } },
        allocations: {
          include: { driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } } },
        },
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // قائمة السائقين لاختيارها في نافذة التوزيع
  const driverRows = await prisma.driver.findMany({
    where: { employee: { companyId, isActive: true, isDeleted: false } },
    include: { employee: { select: { nameAr: true, nameEn: true } } },
    orderBy: { employee: { nameAr: "asc" } },
  });
  const driverOptions = driverRows.map((d) => ({
    id: d.id,
    name: locale === "en" ? d.employee.nameEn ?? d.employee.nameAr : d.employee.nameAr,
  }));

  const totalPages = Math.ceil(total / pageSize);
  const totalOrders = await prisma.deliveryDailyOrder.aggregate({ where, _sum: { ordersCount: true } });

  const canUpdate = hasPermission(session, "DELIVERY_OPERATIONS", "UPDATE", { companyId });
  const canDelete = hasPermission(session, "DELIVERY_OPERATIONS", "DELETE", { companyId });

  return (
    <div>
      <Header
        title={locale === "en" ? "Daily Orders" : "الطلبات اليومية"}
        subtitle={locale === "en" ? "Daily order log for drivers" : "سجل الطلبات اليومية للسائقين"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/delivery/daily-orders/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New daily entry" : "تسجيل يومي"}
          </Link>
        }
      />
      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Total records" : "إجمالي السجلات"}
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="number text-2xl font-bold">{totalOrders._sum.ordersCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? "Total orders" : "إجمالي الطلبات"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !sp.contractId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {locale === "en" ? "All" : "الكل"}
          </a>
          {contracts.map((contract) => (
            <a
              key={contract.id}
              href={`/dashboard/companies/${companyId}/delivery/daily-orders?contractId=${contract.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                sp.contractId === contract.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {locale === "en" ? contract.nameEn ?? contract.nameAr : contract.nameAr}
            </a>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Driver" : "السائق"}</th>
                  <th>{locale === "en" ? "Contract" : "العقد"}</th>
                  <th>{locale === "en" ? "Orders count" : "عدد الطلبات"}</th>
                  <th>{locale === "en" ? "Rating" : "التقييم"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No records found" : "لا توجد سجلات"}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30">
                      <td className="text-sm">{formatDate(order.date, numberLocale)}</td>
                      <td className="font-medium">
                        {locale === "en"
                          ? order.driver.employee.nameEn ?? order.driver.employee.nameAr
                          : order.driver.employee.nameAr}
                        {order.allocations.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {order.allocations.map((a) => (
                              <p key={a.id} className="text-xs font-normal text-emerald-600">
                                ↳ {locale === "en" ? a.driver.employee.nameEn ?? a.driver.employee.nameAr : a.driver.employee.nameAr}: {a.allocatedOrders}
                                {a.walletAmount != null && Number(a.walletAmount) > 0 && (
                                  <span className="text-blue-600"> · {Number(a.walletAmount).toFixed(3)} {locale === "en" ? "KWD" : "د.ك"}</span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
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
                      <td className="text-center text-sm">
                        {order.rating ? Number(order.rating).toFixed(1) : "-"}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canUpdate && (
                            <DistributeOrders
                              orderId={order.id}
                              ordersCount={order.ordersCount}
                              originalDriverName={locale === "en" ? order.driver.employee.nameEn ?? order.driver.employee.nameAr : order.driver.employee.nameAr}
                              drivers={driverOptions}
                              initial={order.allocations.map((a) => ({ driverId: a.driverId, allocatedOrders: a.allocatedOrders, walletAmount: a.walletAmount != null ? Number(a.walletAmount) : null, notes: a.notes }))}
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
                              confirmMessage={`حذف طلبات يوم ${formatDate(order.date, numberLocale)} للسائق ${order.driver.employee.nameAr}؟`}
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
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((currentPage) => (
              <a
                key={currentPage}
                href={`/dashboard/companies/${companyId}/delivery/daily-orders?page=${currentPage}${
                  sp.contractId ? `&contractId=${sp.contractId}` : ""
                }`}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  currentPage === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {currentPage}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
