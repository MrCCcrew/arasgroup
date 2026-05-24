import Link from "next/link";
import { FileText, Users, Car, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function AdministrativeAffairsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();

  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [
    licensesCount,
    expiringLicenses30,
    expiringEmployees30,
    vehiclesCount,
    activeEmployees,
    expiringEmployees60,
  ] = await Promise.all([
    prisma.license.count({ where: { companyId, status: { not: "CANCELLED" } } }),
    prisma.license.count({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        licenseExpiryDate: { gte: now, lte: in30Days },
      },
    }),
    prisma.employee.count({
      where: {
        companyId,
        isDeleted: false,
        residencyExpiry: { gte: now, lte: in30Days },
      },
    }),
    prisma.vehicle.count({ where: { companyId, isActive: true } }),
    prisma.employee.count({ where: { companyId, isActive: true, isDeleted: false } }),
    prisma.employee.count({
      where: {
        companyId,
        isDeleted: false,
        residencyExpiry: { gte: now, lte: in60Days },
      },
    }),
  ]);

  const stats = [
    {
      labelAr: "إجمالي التراخيص",
      labelEn: "Total licenses",
      value: licensesCount,
      icon: FileText,
      color: "text-blue-600",
      href: `/dashboard/companies/${companyId}/licenses`,
    },
    {
      labelAr: "تراخيص تنتهي خلال 30 يوم",
      labelEn: "Licenses expiring in 30 days",
      value: expiringLicenses30,
      icon: AlertTriangle,
      color: expiringLicenses30 > 0 ? "text-yellow-600" : "text-muted-foreground",
      href: `/dashboard/companies/${companyId}/licenses`,
    },
    {
      labelAr: "الموظفون النشطون",
      labelEn: "Active employees",
      value: activeEmployees,
      icon: Users,
      color: "text-green-600",
      href: `/dashboard/companies/${companyId}/hr/employees`,
    },
    {
      labelAr: "إقامات تنتهي خلال 30 يوم",
      labelEn: "Residencies expiring in 30 days",
      value: expiringEmployees30,
      icon: AlertTriangle,
      color: expiringEmployees30 > 0 ? "text-red-600" : "text-muted-foreground",
      href: `/dashboard/companies/${companyId}/hr/expiry-alerts`,
    },
    {
      labelAr: "إقامات تنتهي خلال 60 يوم",
      labelEn: "Residencies expiring in 60 days",
      value: expiringEmployees60,
      icon: AlertTriangle,
      color: expiringEmployees60 > 0 ? "text-orange-500" : "text-muted-foreground",
      href: `/dashboard/companies/${companyId}/hr/expiry-alerts`,
    },
    {
      labelAr: "المركبات النشطة",
      labelEn: "Active vehicles",
      value: vehiclesCount,
      icon: Car,
      color: "text-purple-600",
      href: `/dashboard/companies/${companyId}/vehicles`,
    },
  ];

  const quickLinks = [
    {
      labelAr: "التراخيص",
      labelEn: "Licenses",
      href: `/dashboard/companies/${companyId}/licenses`,
    },
    {
      labelAr: "الموظفون",
      labelEn: "Employees",
      href: `/dashboard/companies/${companyId}/hr/employees`,
    },
    {
      labelAr: "تنبيهات الانتهاء",
      labelEn: "Expiry alerts",
      href: `/dashboard/companies/${companyId}/hr/expiry-alerts`,
    },
    {
      labelAr: "المركبات",
      labelEn: "Vehicles",
      href: `/dashboard/companies/${companyId}/vehicles`,
    },
  ];

  return (
    <div>
      <Header
        title={locale === "en" ? "Administrative Affairs" : "الشؤون الإدارية"}
        subtitle={locale === "en" ? "Summary of licenses, employees, and vehicles" : "ملخص التراخيص والموظفين والمركبات"}
        companyId={companyId}
      />
      <div className="page-container space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
          {stats.map((stat) => (
            <Link
              key={stat.labelEn}
              href={stat.href}
              className="stat-card group transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {locale === "en" ? stat.labelEn : stat.labelAr}
                  </p>
                  <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon size={22} className={`mt-1 shrink-0 opacity-60 ${stat.color}`} />
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {locale === "en" ? "Quick links" : "روابط سريعة"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
              >
                {locale === "en" ? link.labelEn : link.labelAr}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
