import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Building2, Users, Shield, Plus, Link2, Palette, DatabaseZap, Info } from "lucide-react";
import Link from "next/link";
import { GroupLogoUpload } from "@/components/group/GroupLogoUpload";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { UiStyleSettingsCard } from "@/components/layout/ui-style-switcher";
import { DatabaseBackup } from "@/components/settings/database-backup";
import { getUiStyle } from "@/lib/ui-style";
import { companyAvatarClasses, companyTypeLabel } from "@/components/modern/company-meta";

const companyTypeLabels: Record<string, string> = {
  DELIVERY: "توصيل",
  CAR_WASH: "غسيل سيارات",
  GENERAL_TRADING: "تجارة عامة",
  CONTRACTING: "مقاولات",
  TRADING: "تجارة عامة",
  HOLDING: "قابضة",
  OTHER: "أخرى",
};

const companyTypeColors: Record<string, string> = {
  DELIVERY: "bg-blue-100 text-blue-700",
  CAR_WASH: "bg-cyan-100 text-cyan-700",
  GENERAL_TRADING: "bg-emerald-100 text-emerald-700",
  CONTRACTING: "bg-orange-100 text-orange-700",
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

  if ((await getUiStyle()) === "modern") {
    const sections = [
      { id: "appearance", label: "المظهر", icon: Palette, show: true },
      { id: "backup", label: "النسخ الاحتياطي", icon: DatabaseZap, show: canManageSystemSettings },
      { id: "groups", label: "المجموعات والشركات", icon: Building2, show: canManageSystemSettings },
      { id: "system", label: "معلومات النظام", icon: Info, show: canManageSystemSettings },
    ].filter((section) => section.show);

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
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="أقسام الإعدادات" className="lg:sticky lg:top-24 lg:self-start">
              <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#E4E8F0] bg-card p-2 lg:flex-col">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex min-h-11 shrink-0 items-center gap-3 rounded-[14px] px-3 text-sm font-bold text-[#334155] hover:bg-[#F1F4F9]"
                  >
                    <section.icon size={18} className="text-[#3B5BDB]" />
                    {section.label}
                  </a>
                ))}
              </div>

              {canManageSystemSettings ? (
                <div className="mt-4 hidden grid-cols-1 gap-2 lg:grid">
                  {[
                    { label: "شركة", value: companiesCount, icon: Building2 },
                    { label: "مستخدم", value: usersCount, icon: Users },
                    { label: "دور وظيفي", value: rolesCount, icon: Shield },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between rounded-[16px] border border-[#E4E8F0] bg-card px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-[#5B6577]"><stat.icon size={16} />{stat.label}</span>
                      <span className="text-lg font-extrabold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </nav>

            <div className="flex min-w-0 flex-col gap-6">
              <section id="appearance" className="scroll-mt-24 space-y-6">
                <UiStyleSettingsCard />
                <ThemeSettings />
              </section>

              {canManageSystemSettings ? (
                <section id="backup" className="scroll-mt-24">
                  <DatabaseBackup />
                </section>
              ) : null}

              {canManageSystemSettings ? (
                <section id="groups" className="scroll-mt-24 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold">المجموعات والشركات</h2>
                    <Link href="/dashboard/settings/groups/new" className="flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                      <Plus size={14} />
                      مجموعة جديدة
                    </Link>
                  </div>

                  {groups.map((group) => (
                    <div key={group.id} className="section-card">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10">
                            <Link2 size={18} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/dashboard?groupId=${group.id}`} className="block truncate font-extrabold hover:text-primary">{group.nameAr}</Link>
                            {group.nameEn ? <p className="text-xs text-muted-foreground">{group.nameEn}</p> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{group.companies.length} شركة</span>
                          <Link href={`/dashboard/settings/groups/${group.id}/edit`} className="text-xs font-bold text-primary hover:underline">تعديل المجموعة</Link>
                        </div>
                      </div>

                      <div className="mb-4 border-b border-border/50 pb-4">
                        <GroupLogoUpload groupId={group.id} currentLogoUrl={group.logoUrl ?? null} groupName={group.nameAr} />
                      </div>

                      {group.companies.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">لا توجد شركات في هذه المجموعة</p>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {group.companies.map((company) => (
                            <div key={company.id} className="flex items-center gap-3 rounded-[16px] border border-[#EEF0F4] p-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-sm font-extrabold ${companyAvatarClasses(company.type)}`}>
                                {(company.nameAr.replace(/^\s*(شركة|شركه)\s+/, "").trim() || company.nameAr).charAt(0)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold" title={company.nameAr}>{company.nameAr}</p>
                                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {companyTypeLabel(company.type)}
                                  <span className={company.isActive ? "text-[#067647]" : "text-[#B42318]"}>• {company.isActive ? "نشط" : "متوقف"}</span>
                                </p>
                              </div>
                              <Link href={`/dashboard/settings/companies/${company.id}/edit`} className="shrink-0 rounded-[12px] border px-3 py-2 text-xs font-bold hover:bg-muted">تعديل</Link>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 border-t border-border/50 pt-3">
                        <Link href={`/dashboard/settings/companies/new?groupId=${group.id}`} className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">
                          <Plus size={14} />
                          إضافة شركة لهذه المجموعة
                        </Link>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              {canManageSystemSettings ? (
                <section id="system" className="section-card scroll-mt-24">
                  <h2 className="mb-4 text-lg font-extrabold">معلومات النظام</h2>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["اسم النظام", "نظام مجموعة عبد الفتاح راشد ERP"],
                      ["العملة", "دينار كويتي (KWD)"],
                      ["المنطقة الزمنية", "Asia/Kuwait (UTC+3)"],
                      ["الإصدار", "1.0.0"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[14px] bg-[#F8FAFC] px-4 py-3">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="mb-6 space-y-6">
          <UiStyleSettingsCard />
          <ThemeSettings />
        </div>

        {canManageSystemSettings ? (
          <div className="mb-6">
            <DatabaseBackup />
          </div>
        ) : null}

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
                      <Link href={`/dashboard?groupId=${group.id}`} className="font-bold hover:text-primary hover:underline truncate">{group.nameAr}</Link>
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
