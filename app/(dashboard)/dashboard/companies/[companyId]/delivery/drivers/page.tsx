import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { daysUntilExpiry, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ platform?: string; search?: string }>;
}

export default async function DriversPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const drivers = await prisma.driver.findMany({
    where: {
      employee: {
        companyId,
        isActive: true,
        isDeleted: false,
        ...(sp.search ? { nameAr: { contains: sp.search } } : {}),
      },
      ...(sp.platform === "TALABAT" ? { isRegisteredTalabat: true } : {}),
      ...(sp.platform === "RO_POPS" ? { isRegisteredRoPops: true } : {}),
    },
    include: {
      employee: {
        select: {
          nameAr: true,
          nameEn: true,
          phone: true,
          residencyExpiry: true,
          nationality: true,
          baseSalary: true,
          civilId: true,
        },
      },
    },
    orderBy: { employee: { nameAr: "asc" } },
  });

  return (
    <div>
      <Header
        title={locale === "en" ? "Drivers" : "السائقون"}
        subtitle={locale === "en" ? `Total: ${drivers.length} driver(s)` : `إجمالي: ${drivers.length} سائق`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/delivery/drivers/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "New driver" : "سائق جديد"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <div className="flex gap-3">
          {[
            { value: "", label: locale === "en" ? `All (${drivers.length})` : `الكل (${drivers.length})` },
            { value: "TALABAT", label: locale === "en" ? "Talabat" : "طلبات" },
            { value: "RO_POPS", label: "Ro Pops" },
          ].map((filterItem) => (
            <Link
              key={filterItem.value}
              href={`/dashboard/companies/${companyId}/delivery/drivers${filterItem.value ? `?platform=${filterItem.value}` : ""}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                (sp.platform ?? "") === filterItem.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {filterItem.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const days = daysUntilExpiry(driver.employee.residencyExpiry);
            const isExpired = days !== null && days < 0;
            const isExpiringSoon = days !== null && days <= 60;
            const driverName = locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr;

            return (
              <Link key={driver.id} href={`/dashboard/companies/${companyId}/delivery/drivers/${driver.id}`} className="group block">
                <div className={`rounded-xl border bg-card p-4 transition-all hover:shadow-md ${isExpiringSoon ? "border-yellow-300" : ""}`}>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">{driverName}</h3>
                      <p className="text-xs text-muted-foreground">{driver.employee.nationality}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {driver.isRegisteredTalabat && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                          {locale === "en" ? "Talabat" : "طلبات"}
                        </span>
                      )}
                      {driver.isRegisteredRoPops && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Ro Pops</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{locale === "en" ? "Phone" : "الجوال"}</p>
                      <p className="font-medium" dir="ltr">
                        {driver.employee.phone ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{locale === "en" ? "Wallet balance" : "رصيد المحفظة"}</p>
                      <p
                        className={`number font-bold ${
                          Number(driver.walletBalance) > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatKWD(Number(driver.walletBalance), numberLocale)}
                      </p>
                    </div>
                  </div>

                  {isExpiringSoon && (
                    <div className={`mt-3 flex items-center gap-1.5 rounded-lg p-2 text-xs ${
                      isExpired
                        ? "bg-red-50 text-red-700 font-medium"
                        : days !== null && days <= 30
                          ? "bg-red-50 text-red-700"
                          : "bg-yellow-50 text-yellow-700"
                    }`}>
                      <AlertTriangle size={12} />
                      {isExpired
                        ? (locale === "en" ? "Residency expired — please renew or update data" : "انتهت الإقامة — يرجى التجديد أو تحديث البيانات")
                        : (locale === "en" ? `Residency expires in ${days} day(s)` : `الإقامة تنتهي خلال ${days} يوم`)}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

          {drivers.length === 0 && (
            <div className="col-span-3 py-12 text-center text-muted-foreground">
              {locale === "en" ? "No drivers found" : "لا يوجد سائقون"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
