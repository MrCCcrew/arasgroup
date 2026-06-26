import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Building2, Users, Shield, Plus, Link2 } from "lucide-react";
import Link from "next/link";
import { GroupLogoUpload } from "@/components/group/GroupLogoUpload";
import { ThemeSettings } from "@/components/settings/theme-settings";

const companyTypeLabels: Record<string, string> = {
  DELIVERY: "توصيل",
  CAR_WASH: "غسيل سيارات",
  GENERAL_TRADING: "تجارة عامة",
  TRADING: "تجارة",
  HOLDING: "قابضة",
  OTHER: "أخرى",
};

const companyTypeColors: Record<string, string> = {
  DELIVERY: "bg-blue-100 text-blue-700",
  CAR_WASH: "bg-cyan-100 text-cyan-700",
  GENERAL_TRADING: "bg-emerald-100 text-emerald-700",
  TRADING: "bg-emerald-100 text-emerald-700",
  HOLDING: "bg-purple-100 text-purple-700",
  OTHER: "bg-gray-100 text-gray-700",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManageSystemSettings = session.isSuperAdmin;

  const [companiesCount, usersCount, rolesCount, groups] = canManageSystemSettings
    ? await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.role.count(),
        prisma.group.findMany({
          include: {
            companies: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [0, 0, 0, []];

  return (
    <div>
      <Header
        title="إعدادات النظام"
        subtitle={canManageSystemSettings ? "إدارة المجموعات والشركات" : "تخصيص مظهر النظام"}
        actions={canManageSystemSettings ? (
          <Link
            href="/dashboard/settings/companies/new"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            شركة جديدة
          </Link>
        ) : undefined}
      />

      <div className="page-container">
        {canManageSystemSettings ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{companiesCount}</p>
                <p className="text-xs text-muted-foreground">شركة</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{usersCount}</p>
                <p className="text-xs text-muted-foreground">مستخدم</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Shield size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rolesCount}</p>
                <p className="text-xs text-muted-foreground">دور وظيفي</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          <ThemeSettings />
        </div>

        {canManageSystemSettings ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">المجموعات والشركات</h2>
              <Link
                href="/dashboard/settings/groups/new"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus size={14} />
                مجموعة جديدة
              </Link>
            </div>

            {groups.map((group) => (
              <div key={group.id} className="section-card">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Link2 size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{group.nameAr}</h3>
                      {group.nameEn && <p className="text-xs text-muted-foreground">{group.nameEn}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                      {group.companies.length} شركة
                    </span>
                    <Link
                      href={`/dashboard/settings/groups/${group.id}/edit`}
                      className="text-xs text-primary hover:underline"
                    >
                      تعديل المجموعة
                    </Link>
                  </div>
                </div>

                <div className="mb-4 pb-4 border-b border-border/50">
                  <GroupLogoUpload
                    groupId={group.id}
                    currentLogoUrl={group.logoUrl ?? null}
                    groupName={group.nameAr}
                  />
                </div>

                {group.companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد شركات في هذه المجموعة</p>
                ) : (
                  <div className="space-y-2">
                    {group.companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-card border rounded-lg flex items-center justify-center">
                            <Building2 size={14} className="text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{company.nameAr}</p>
                            {company.nameEn && (
                              <p className="text-xs text-muted-foreground">{company.nameEn}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${companyTypeColors[company.type] ?? "bg-gray-100 text-gray-700"}`}>
                            {companyTypeLabels[company.type] ?? company.type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${company.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {company.isActive ? "نشط" : "متوقف"}
                          </span>
                          <Link
                            href={`/dashboard/settings/companies/${company.id}/edit`}
                            className="text-xs text-primary hover:underline"
                          >
                            تعديل
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border/50">
                  <Link
                    href={`/dashboard/settings/companies/new?groupId=${group.id}`}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus size={14} />
                    إضافة شركة لهذه المجموعة
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {canManageSystemSettings ? (
          <div className="section-card">
            <h2 className="font-bold text-base mb-4">معلومات النظام</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">اسم النظام</span>
                <span className="font-medium">نظام مجموعة عبد الفتاح راشد ERP</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">العملة</span>
                <span className="font-medium">دينار كويتي (KWD)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">المنطقة الزمنية</span>
                <span className="font-medium">Asia/Kuwait (UTC+3)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">الإصدار</span>
                <span className="font-medium">1.0.0</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
