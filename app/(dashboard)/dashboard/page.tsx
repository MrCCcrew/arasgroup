import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Building2, TrendingUp, Truck, UserRound, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ExpiryAlertsPanel } from "./ExpiryAlertsPanel";

const DRIVER_TYPES = ["DRIVER", "DELIVERY_DRIVER", "CAR_WASH_DRIVER"] as const;
const ADMIN_TYPES = ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB", "OFFICE_BOY", "OTHER"] as const;

export default async function GroupDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const companyFilter = session.isSuperAdmin ? {} : { id: { in: session.companyAccess } };
  const employeeCompanyFilter = session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } };

  const [companies, totalEmployees, expiringResidencies, totalActiveByCompany, driverByCompany, adminByCompany, investorByCompany, deletedByCompany] =
    await Promise.all([
      prisma.company.findMany({
        where: { isActive: true, ...companyFilter },
        include: { _count: { select: { branches: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.employee.count({
        where: {
          isActive: true,
          isDeleted: false,
          ...employeeCompanyFilter,
        },
      }),
      prisma.employee.count({
        where: {
          isActive: true,
          isDeleted: false,
          ...employeeCompanyFilter,
          residencyExpiry: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), gte: new Date() },
        },
      }),
      prisma.employee.groupBy({
        by: ["companyId"],
        where: {
          isActive: true,
          isDeleted: false,
          ...employeeCompanyFilter,
        },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["companyId"],
        where: {
          isActive: true,
          isDeleted: false,
          type: { in: [...DRIVER_TYPES] },
          ...employeeCompanyFilter,
        },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["companyId"],
        where: {
          isActive: true,
          isDeleted: false,
          investorId: null,
          type: { in: [...ADMIN_TYPES] },
          ...employeeCompanyFilter,
        },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["companyId"],
        where: {
          isActive: true,
          isDeleted: false,
          investorId: { not: null },
          ...employeeCompanyFilter,
        },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["companyId"],
        where: {
          isDeleted: true,
          ...employeeCompanyFilter,
        },
        _count: { _all: true },
      }),
    ]);

  const totalMap = new Map(totalActiveByCompany.map((row) => [row.companyId, row._count._all]));
  const driverMap = new Map(driverByCompany.map((row) => [row.companyId, row._count._all]));
  const adminMap = new Map(adminByCompany.map((row) => [row.companyId, row._count._all]));
  const investorMap = new Map(investorByCompany.map((row) => [row.companyId, row._count._all]));
  const deletedMap = new Map(deletedByCompany.map((row) => [row.companyId, row._count._all]));

  const companyIds = companies.map((company) => company.id);

  const companyTypeLabels: Record<string, string> = {
    DELIVERY: "شركة توصيل",
    CAR_WASH: "شركة غسيل سيارات",
    GENERAL_TRADING: "تجارة عامة",
    TRADING: "تجارة",
    HOLDING: "قابضة",
    OTHER: "أخرى",
  };

  const companyTypeColors: Record<string, string> = {
    DELIVERY: "bg-blue-500",
    CAR_WASH: "bg-cyan-500",
    GENERAL_TRADING: "bg-emerald-500",
    TRADING: "bg-emerald-600",
    HOLDING: "bg-violet-500",
    OTHER: "bg-slate-500",
  };

  const quickLinks = [
    session.isSuperAdmin || hasPermission(session, "USERS", "VIEW")
      ? { href: "/dashboard/users", label: "إدارة المستخدمين", icon: <Users size={16} /> }
      : null,
    session.isSuperAdmin || hasPermission(session, "SETTINGS", "VIEW")
      ? { href: "/dashboard/settings", label: "إعدادات النظام", icon: <Building2 size={16} /> }
      : null,
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <div>
      <Header title="لوحة تحكم المجموعة" subtitle="عبد الفتاح راشد سليمان - الكويت" />

      <div className="page-container">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={<Building2 size={20} className="text-blue-600" />} label="إجمالي الشركات" value={companies.length} bg="bg-blue-50" />
          <StatCard icon={<Users size={20} className="text-green-600" />} label="إجمالي الموظفين" value={totalEmployees} bg="bg-green-50" />
          <StatCard icon={<AlertTriangle size={20} className="text-yellow-600" />} label="إقامات تنتهي قريبًا" value={expiringResidencies} bg="bg-yellow-50" alert />
          <StatCard icon={<TrendingUp size={20} className="text-purple-600" />} label="الفترة المالية" value={new Date().getFullYear()} bg="bg-purple-50" />
        </div>

        <ExpiryAlertsPanel companyIds={companyIds} />

        <div>
          <h2 className="mb-4 text-lg font-bold">الشركات</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const total = totalMap.get(company.id) ?? 0;
              const drivers = driverMap.get(company.id) ?? 0;
              const admins = adminMap.get(company.id) ?? 0;
              const investorEmployees = investorMap.get(company.id) ?? 0;
              const deleted = deletedMap.get(company.id) ?? 0;

              return (
                <Link key={company.id} href={`/dashboard/companies/${company.id}`} className="block group">
                  <div className="rounded-xl border bg-card p-5 transition-all group-hover:border-primary/30 group-hover:shadow-md">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${companyTypeColors[company.type] ?? "bg-gray-500"}`}>
                        {company.logoUrl ? (
                          <Image src={company.logoUrl} alt={company.nameAr} width={40} height={40} className="h-full w-full object-contain p-0.5" unoptimized />
                        ) : (
                          <span className="text-sm font-bold text-white">{company.nameAr.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-foreground">{company.nameAr}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{companyTypeLabels[company.type] ?? company.type}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{total}</p>
                        <p className="text-xs text-muted-foreground">موظف نشط</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{company._count.branches}</p>
                        <p className="text-xs text-muted-foreground">فرع</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-sky-50 px-3 py-2 text-sky-700">
                        <div className="flex items-center justify-between gap-2">
                          <span>السائقون</span>
                          <Truck size={13} />
                        </div>
                        <div className="mt-1 font-bold">{drivers}</div>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
                        <div className="flex items-center justify-between gap-2">
                          <span>الإداريون</span>
                          <Users size={13} />
                        </div>
                        <div className="mt-1 font-bold">{admins}</div>
                      </div>
                      <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                        <div className="flex items-center justify-between gap-2">
                          <span>موظفو المسئولين</span>
                          <UserRound size={13} />
                        </div>
                        <div className="mt-1 font-bold">{investorEmployees}</div>
                      </div>
                      {session.isSuperAdmin && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
                          <div className="flex items-center justify-between gap-2">
                            <span>المحذوفون</span>
                            <AlertTriangle size={13} />
                          </div>
                          <div className="mt-1 font-bold">{deleted}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-1 text-xs ${company.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {company.isActive ? "نشط" : "متوقف"}
                      </span>
                      <span className="text-xs font-medium text-primary group-hover:underline">دخول →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {quickLinks.length > 0 ? (
          <div>
            <h2 className="mb-4 text-lg font-bold">روابط سريعة</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm font-medium transition-colors hover:bg-muted">
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
  alert?: boolean;
}) {
  return (
    <div className={`stat-card ${alert ? "border-yellow-200" : ""}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
