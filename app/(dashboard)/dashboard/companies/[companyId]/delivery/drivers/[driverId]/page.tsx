import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Calendar, CreditCard, Pencil, Phone } from "lucide-react";
import { DriverDeleteButton } from "./DriverDeleteButton";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { Header } from "@/components/layout/header";
import { WalletDepositButton } from "@/components/delivery/wallet-deposit-button";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { daysUntilExpiry, formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; driverId: string }>;
}

const WALLET_TX_LABELS = {
  ar: {
    DEBIT: "خصم",
    CREDIT: "إضافة",
    SETTLEMENT: "تسوية",
    ADVANCE: "سلفة",
    DEDUCTION: "خصم راتب",
  },
  en: {
    DEBIT: "Debit",
    CREDIT: "Credit",
    SETTLEMENT: "Settlement",
    ADVANCE: "Advance",
    DEDUCTION: "Salary deduction",
  },
} as const;

export default async function DriverDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, driverId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      employee: {
        select: {
          nameAr: true,
          nameEn: true,
          phone: true,
          nationality: true,
          civilId: true,
          baseSalary: true,
          dateOfBirth: true,
          residencyExpiry: true,
          companyId: true,
          isActive: true,
        },
      },
      vehicleAssignments: {
        where: { isActive: true },
        select: { assignedFrom: true },
        take: 1,
      },
      assignedVehicle: {
        select: {
          id: true,
          plateNumber: true,
          make: true,
          model: true,
          companyId: true,
          company: { select: { nameAr: true } },
        },
      },
      walletTransactions: {
        orderBy: { date: "desc" },
        take: 20,
      },
      dailyOrders: {
        orderBy: { date: "desc" },
        take: 10,
        include: {
          contract: { select: { platform: true } },
        },
      },
    },
  });

  if (!driver || driver.employee.companyId !== companyId) notFound();

  // Violations query is separate + guarded so it doesn't crash if DB migration pending
  type ViolationRow = {
    id: string; date: Date; type: string; amount: unknown;
    responsibility: string; driverSharePct: number | null;
    paymentMode: string; installmentMonths: number | null;
    installmentsPaid: number; status: string; locationAr: string | null;
  };
  let driverViolations: ViolationRow[] = [];
  try {
    driverViolations = await (prisma.driverViolation as any).findMany({
      where: { driverId, status: { not: "CANCELLED" } },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        id: true, date: true, type: true, amount: true,
        responsibility: true, driverSharePct: true,
        paymentMode: true, installmentMonths: true, installmentsPaid: true,
        status: true, locationAr: true,
      },
    });
  } catch {
    // New fields not yet migrated — skip violations section
  }

  const residencyDays = daysUntilExpiry(driver.employee.residencyExpiry);

  const totalOrders = await prisma.deliveryDailyOrder.aggregate({
    where: { driverId },
    _sum: { ordersCount: true },
    _count: { id: true },
  });

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const monthOrders = await prisma.deliveryDailyOrder.aggregate({
    where: { driverId, date: { gte: thisMonthStart } },
    _sum: { ordersCount: true },
  });

  const driverName = locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr;

  return (
    <div>
      <Header
        title={driverName}
        subtitle={locale === "en" ? "Driver profile" : "ملف السائق"}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}/edit`}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil size={15} />
              {locale === "en" ? "Edit" : "تعديل"}
            </Link>
            {session.isSuperAdmin && (
              <DriverDeleteButton
                driverId={driverId}
                companyId={companyId}
                driverName={driverName}
              />
            )}
          </div>
        }
      />

      <div className="page-container space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/drivers`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to drivers" : "العودة للسائقين"}
        </Link>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Driver information" : "بيانات السائق"}
            </h2>

            {driver.employee.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="shrink-0 text-muted-foreground" />
                <span dir="ltr">{driver.employee.phone}</span>
              </div>
            )}
            {driver.employee.civilId && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard size={14} className="shrink-0 text-muted-foreground" />
                <span dir="ltr">{driver.employee.civilId}</span>
              </div>
            )}
            {driver.employee.nationality && (
              <div className="text-sm">
                <span className="text-muted-foreground">{locale === "en" ? "Nationality: " : "الجنسية: "}</span>
                <span>{driver.employee.nationality}</span>
              </div>
            )}
            {driver.employee.dateOfBirth && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="shrink-0 text-muted-foreground" />
                <span>{formatDate(driver.employee.dateOfBirth, locale === "en" ? "en-US" : "ar-KW")}</span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">{locale === "en" ? "Base salary: " : "الراتب الأساسي: "}</span>
              <span className="number font-bold">{formatKWD(Number(driver.employee.baseSalary ?? 0), numberLocale)}</span>
            </div>

            <div className="space-y-2 border-t pt-2">
              {driver.isRegisteredTalabat && (
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                    {locale === "en" ? "Talabat" : "طلبات"}
                  </span>
                  {driver.talabatId && <span className="text-xs text-muted-foreground">{driver.talabatId}</span>}
                </div>
              )}
              {driver.isRegisteredRoPops && (
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Ro Pops</span>
                  {driver.roPopsId && <span className="text-xs text-muted-foreground">{driver.roPopsId}</span>}
                </div>
              )}
            </div>

            {driver.assignedVehicle && (
              <div className="flex flex-col gap-1 border-t pt-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">{locale === "en" ? "Vehicle:" : "المركبة:"}</span>
                  <span className="font-medium">{driver.assignedVehicle.plateNumber}</span>
                  {(driver.assignedVehicle.make || driver.assignedVehicle.model) && (
                    <span className="text-muted-foreground text-xs">
                      {[driver.assignedVehicle.make, driver.assignedVehicle.model].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {driver.assignedVehicle.companyId !== companyId && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {driver.assignedVehicle.company.nameAr}
                    </span>
                  )}
                </div>
                {driver.vehicleAssignments[0]?.assignedFrom && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar size={11} />
                    <span>
                      {locale === "en" ? "Received: " : "استلمها: "}
                      {new Date(driver.vehicleAssignments[0].assignedFrom).toLocaleString(
                        locale === "en" ? "en-US" : "ar-KW",
                        { dateStyle: "medium", timeStyle: "short" }
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {residencyDays !== null && residencyDays <= 90 && (
              <div className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium ${
                residencyDays < 0
                  ? "bg-red-50 text-red-700"
                  : residencyDays <= 30
                    ? "bg-red-50 text-red-700"
                    : "bg-yellow-50 text-yellow-700"
              }`}>
                <AlertTriangle size={12} />
                {residencyDays < 0
                  ? (locale === "en" ? "Residency expired — please renew or update data" : "انتهت الإقامة — يرجى التجديد أو تحديث البيانات")
                  : (locale === "en" ? `Residency expires in ${residencyDays} day(s)` : `الإقامة تنتهي خلال ${residencyDays} يوم`)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Wallet balance" : "رصيد المحفظة"}</p>
              <p className={`number text-xl font-bold ${Number(driver.walletBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatKWD(Number(driver.walletBalance), numberLocale)}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Total orders" : "إجمالي الأوردرات"}</p>
              <p className="number text-xl font-bold">{totalOrders._sum.ordersCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {locale === "en" ? `${totalOrders._count.id} work day(s)` : `${totalOrders._count.id} يوم عمل`}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{locale === "en" ? "Orders this month" : "أوردرات هذا الشهر"}</p>
              <p className="number text-xl font-bold text-primary">{monthOrders._sum.ordersCount ?? 0}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">{locale === "en" ? "Wallet transactions" : "حركات المحفظة"}</h2>
            <div className="flex items-center gap-3">
              <WalletDepositButton
                driverId={driverId}
                companyId={companyId}
                driverName={driverName}
                currentBalance={Number(driver.walletBalance)}
                locale={locale}
              />
              <Link
                href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}/wallet-statement`}
                className="rounded-lg border border-primary bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
              >
                {locale === "en" ? "Full Statement" : "كشف حساب كامل"}
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Amount" : "المبلغ"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {driver.walletTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No transactions found" : "لا توجد حركات"}
                    </td>
                  </tr>
                ) : (
                  driver.walletTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(transaction.date, numberLocale)}</td>
                      <td>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {WALLET_TX_LABELS[locale][transaction.type as keyof typeof WALLET_TX_LABELS.ar] ?? transaction.type}
                        </span>
                      </td>
                      <td className="text-sm text-muted-foreground">{transaction.descriptionAr ?? "-"}</td>
                      <td className={`number font-bold ${Number(transaction.amount) >= 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatKWD(Number(transaction.amount), numberLocale)}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${transaction.isSettled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {transaction.isSettled ? (locale === "en" ? "Settled" : "مسوى") : locale === "en" ? "Pending" : "غير مسوى"}
                        </span>
                      </td>
                      <td>
                        {session.isSuperAdmin && (
                          <DeleteConfirmButton
                            apiUrl={`/api/delivery/wallet/${transaction.id}`}
                            confirmMessage="حذف هذه الحركة من المحفظة وعكس المبلغ؟"
                            warningMessage="سيتم عكس المبلغ تلقائياً على رصيد المحفظة"
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">{locale === "en" ? "Recent daily orders" : "آخر الأوردرات اليومية"}</h2>
            <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders?driverId=${driverId}`} className="text-xs text-primary hover:underline">
              {locale === "en" ? "View all" : "عرض الكل"}
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Platform" : "المنصة"}</th>
                  <th>{locale === "en" ? "Orders count" : "عدد الأوردرات"}</th>
                  <th>{locale === "en" ? "Rating" : "التقييم"}</th>
                </tr>
              </thead>
              <tbody>
                {driver.dailyOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No daily orders found" : "لا توجد أوردرات"}
                    </td>
                  </tr>
                ) : (
                  driver.dailyOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(order.date, numberLocale)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          order.contract.platform === "TALABAT" ? "bg-orange-100 text-orange-700"
                          : order.contract.platform === "RO_POPS" ? "bg-blue-100 text-blue-700"
                          : order.contract.platform ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                        }`}>
                          {order.contract.platform === "TALABAT" ? (locale === "en" ? "Talabat" : "طلبات")
                            : order.contract.platform === "RO_POPS" ? "Ro Pops"
                            : order.contract.platform ?? (locale === "en" ? "No platform" : "بدون منصة")}
                        </span>
                      </td>
                      <td className="number font-bold">{order.ordersCount}</td>
                      <td className="number">{order.rating ? Number(order.rating).toFixed(1) : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* المخالفات */}
        {driverViolations.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">{locale === "en" ? "Violations" : "المخالفات"}</h2>
              <a
                href={`/dashboard/companies/${companyId}/delivery/violations`}
                className="text-xs text-primary hover:underline"
              >
                {locale === "en" ? "All violations" : "كل المخالفات"}
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                    <th>{locale === "en" ? "Type" : "النوع"}</th>
                    <th>{locale === "en" ? "Location" : "المكان"}</th>
                    <th>{locale === "en" ? "Amount" : "المبلغ"}</th>
                    <th>{locale === "en" ? "Responsibility" : "المسؤولية"}</th>
                    <th>{locale === "en" ? "Payment" : "السداد"}</th>
                    <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  </tr>
                </thead>
                <tbody>
                  {driverViolations.map((v) => {
                    const driverShare = v.responsibility === "SPLIT" ? (v.driverSharePct ?? 50) / 100 : v.responsibility === "DRIVER" ? 1 : 0;
                    const driverAmount = Number(v.amount) * driverShare;
                    const totalInst = v.paymentMode === "INSTALLMENT" ? (v.installmentMonths ?? 1) : 1;
                    return (
                      <tr key={v.id} className="hover:bg-muted/20">
                        <td className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(v.date).toLocaleString(locale === "en" ? "en-US" : "ar-KW", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="text-sm font-medium">{v.type}</td>
                        <td className="text-sm text-muted-foreground">{v.locationAr ?? "—"}</td>
                        <td className="number text-sm font-bold text-red-600">
                          {driverAmount > 0 ? formatKWD(Number(driverAmount), numberLocale) : "—"}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            v.responsibility === "DRIVER" ? "bg-red-100 text-red-700"
                            : v.responsibility === "COMPANY" ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                          }`}>
                            {v.responsibility === "DRIVER" ? (locale === "en" ? "Driver" : "السائق")
                              : v.responsibility === "COMPANY" ? (locale === "en" ? "Company" : "الشركة")
                              : `${locale === "en" ? "Split" : "مقسّم"} ${v.driverSharePct ?? 50}%`}
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {v.paymentMode === "INSTALLMENT"
                            ? `${v.installmentsPaid}/${totalInst} ${locale === "en" ? "paid" : "مدفوع"}`
                            : locale === "en" ? "Lump sum" : "دفعة واحدة"}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            v.status === "PENDING" ? "bg-yellow-100 text-yellow-700"
                            : v.status === "SETTLED" ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                          }`}>
                            {v.status === "PENDING" ? (locale === "en" ? "Pending" : "قيد التسوية")
                              : v.status === "SETTLED" ? (locale === "en" ? "Settled" : "مسوّاة")
                              : (locale === "en" ? "Cancelled" : "ملغية")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
