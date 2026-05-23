import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { hasPermission } from "@/lib/auth/permissions";
import { Building2, Users, TrendingUp, AlertTriangle } from "lucide-react";

export default async function GroupDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [companies, totalEmployees, expiringResidencies] = await Promise.all([
    prisma.company.findMany({
      where: {
        isActive: true,
        ...(session.isSuperAdmin ? {} : { id: { in: session.companyAccess } }),
      },
      include: {
        _count: { select: { employees: true, branches: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.count({
      where: {
        isActive: true,
        isDeleted: false,
        ...(session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } }),
      },
    }),
    prisma.employee.count({
      where: {
        isActive: true,
        isDeleted: false,
        ...(session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } }),
        residencyExpiry: {
          lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ]);

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
      <Header
        title="لوحة تحكم المجموعة"
        subtitle="عبد الفتاح راشد سليمان - الكويت"
      />

      <div className="page-container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Building2 size={20} className="text-blue-600" />}
            label="إجمالي الشركات"
            value={companies.length}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<Users size={20} className="text-green-600" />}
            label="إجمالي الموظفين"
            value={totalEmployees}
            bg="bg-green-50"
          />
          <StatCard
            icon={<AlertTriangle size={20} className="text-yellow-600" />}
            label="إقامات تنتهي قريبا"
            value={expiringResidencies}
            bg="bg-yellow-50"
            alert
          />
          <StatCard
            icon={<TrendingUp size={20} className="text-purple-600" />}
            label="الفترة المالية"
            value={new Date().getFullYear()}
            bg="bg-purple-50"
          />
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4">الشركات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/dashboard/companies/${company.id}`}
                className="block group"
              >
                <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-all group-hover:border-primary/30">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 ${companyTypeColors[company.type] ?? "bg-gray-500"} rounded-lg flex items-center justify-center shrink-0`}>
                      <span className="text-white font-bold text-sm">{company.nameAr.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{company.nameAr}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {companyTypeLabels[company.type] ?? company.type}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{company._count.employees}</p>
                      <p className="text-xs text-muted-foreground">موظف</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{company._count.branches}</p>
                      <p className="text-xs text-muted-foreground">فرع</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${company.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {company.isActive ? "نشط" : "متوقف"}
                    </span>
                    <span className="text-xs text-primary font-medium group-hover:underline">دخول →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {quickLinks.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-4">روابط سريعة</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted rounded-lg text-sm font-medium transition-colors"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
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
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
