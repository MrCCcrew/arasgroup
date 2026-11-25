import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Car,
  ChevronLeft,
  MoreHorizontal,
  FileText,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { hasPermission } from "@/lib/auth/permissions";
import { CompanyLogoUpload } from "@/components/company/CompanyLogoUpload";
import { daysUntilExpiry, formatDate, formatKWD } from "@/lib/utils";
import { getUiStyle } from "@/lib/ui-style";
import { companyAvatarClasses } from "@/components/modern/company-meta";

interface Props {
  params: Promise<{ companyId: string }>;
}

const companyTypeLabels = {
  ar: {
    DELIVERY: "توصيل",
    CAR_WASH: "غسيل سيارات",
    TRADING: "تجارة عامة",
    GENERAL_TRADING: "تجارة عامة",
    CONTRACTING: "مقاولات",
    GROCERY: "بقالة ومخزون",
    HOLDING: "قابضة",
    OTHER: "أخرى",
  },
  en: {
    DELIVERY: "Delivery",
    CAR_WASH: "Car Wash",
    TRADING: "General Trading",
    GENERAL_TRADING: "General Trading",
    CONTRACTING: "Contracting",
    GROCERY: "Grocery & inventory",
    HOLDING: "Holding",
    OTHER: "Other",
  },
} as const;

const journalStatusLabels = {
  ar: {
    DRAFT: "مسودة",
    PENDING_APPROVAL: "بانتظار الموافقة",
    APPROVED: "معتمد",
    POSTED: "مرحل",
    REJECTED: "مرفوض",
    CANCELLED: "ملغي",
  },
  en: {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    POSTED: "Posted",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  },
} as const;

export default async function CompanyDashboardPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: { where: { isActive: true } },
      _count: {
        select: {
          employees: { where: { isActive: true, isDeleted: false } },
          branches: { where: { isActive: true } },
        },
      },
    },
  });

  if (!company) notFound();
  if (company.type === "OWNER_MANAGED") redirect(`/dashboard/companies/${companyId}/owner-management`);

  const canViewAccountingForQuery = session.isSuperAdmin || hasPermission(session, "ACCOUNTING", "VIEW", { companyId });

  const [
    unpostedJEs,
    mainLicensesCount,
    subLicensesCount,
    expiringResidencies,
    expiringLicenses,
    recentJEs,
  ] = await Promise.all([
    // قيود مسودة (فقط لمن يملك صلاحية المحاسبة)
    canViewAccountingForQuery
      ? prisma.journalEntry.count({
          where: {
            companyId,
            status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] },
            isDeleted: false,
          },
        })
      : Promise.resolve(0),
    // عدد التراخيص الرئيسية (بدون الملغاة)
    prisma.license.count({
      where: { companyId, isMainLicense: true, status: { not: "CANCELLED" } },
    }),
    // عدد التراخيص الفرعية (بدون الملغاة)
    prisma.license.count({
      where: { companyId, isMainLicense: false, status: { not: "CANCELLED" } },
    }),
    // إقامات تنتهي خلال 30 يوم
    prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        isDeleted: false,
        residencyExpiry: { lte: in30Days, gte: now },
      },
      select: { nameAr: true, nameEn: true, residencyExpiry: true },
      orderBy: { residencyExpiry: "asc" },
      take: 5,
    }),
    // تراخيص تنتهي خلال 60 يوم (بدون الملغاة)
    prisma.license.count({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        licenseExpiryDate: { lte: in60Days, gte: now },
      },
    }),
    // آخر القيود (فقط لمن يملك صلاحية المحاسبة)
    canViewAccountingForQuery
      ? prisma.journalEntry.findMany({
          where: { companyId, isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            number: true,
            date: true,
            descriptionAr: true,
            descriptionEn: true,
            status: true,
            totalDebit: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // عدد الموظفين في التراخيص الرئيسية والفرعية
  const [empInMainLicenses, empInSubLicenses] = await Promise.all([
    prisma.employeeLicenseAssignment.count({
      where: { license: { companyId, isMainLicense: true, status: { not: "CANCELLED" } } },
    }),
    prisma.employeeLicenseAssignment.count({
      where: { license: { companyId, isMainLicense: false, status: { not: "CANCELLED" } } },
    }),
  ]);

  type RecentJournalEntryRow = typeof recentJEs[number];
  type ExpiringResidencyRow = typeof expiringResidencies[number];

  const isDelivery = company.type === "DELIVERY";
  const isCarWash = company.type === "CAR_WASH";
  const isTrading = company.type === "TRADING" || company.type === "GENERAL_TRADING";
  const companyName = locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr;
  const canViewAccounting = session.isSuperAdmin || hasPermission(session, "ACCOUNTING", "VIEW", { companyId });

  // ── الروابط السريعة حسب الصلاحيات ──────────────────────────────
  type QuickLink = { href: string; label: string; icon: React.ReactNode; color: string };
  const quickLinks: QuickLink[] = [];

  const canDo = (module: Parameters<typeof hasPermission>[1], action: Parameters<typeof hasPermission>[2]) =>
    session.isSuperAdmin || hasPermission(session, module, action, { companyId });

  if (canDo("ACCOUNTING", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/accounting/journal-entries/new`, label: locale === "en" ? "New journal entry" : "قيد جديد", color: "blue", icon: <Receipt size={16} /> });

  if (canDo("EXPENSES", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/expenses/new`, label: locale === "en" ? "New expense" : "مصروف جديد", color: "orange", icon: <Receipt size={16} /> });

  if (canDo("HR", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/hr/employees/new`, label: locale === "en" ? "New employee" : "موظف جديد", color: "green", icon: <Users size={16} /> });

  if (canDo("LICENSES", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/licenses`, label: locale === "en" ? "Licenses" : "التراخيص", color: "violet", icon: <ShieldCheck size={16} /> });

  if (canDo("HR", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/hr/employees`, label: locale === "en" ? "Employees" : "الموظفون", color: "teal", icon: <Users size={16} /> });

  if (canDo("ACCOUNTING", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/accounting/journal-entries`, label: locale === "en" ? "Journal entries" : "القيود اليومية", color: "slate", icon: <BookOpen size={16} /> });

  if (isDelivery && canDo("DELIVERY_OPERATIONS", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/delivery/daily-orders/new`, label: locale === "en" ? "Daily orders" : "أوردر يومي", color: "indigo", icon: <TrendingUp size={16} /> });

  if (isDelivery && canDo("DELIVERY_OPERATIONS", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/delivery/wallet`, label: locale === "en" ? "Driver wallets" : "محفظة السائقين", color: "purple", icon: <Wallet size={16} /> });

  if (isDelivery && canDo("DELIVERY_HR", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/delivery/drivers`, label: locale === "en" ? "Drivers" : "السائقون", color: "sky", icon: <Truck size={16} /> });

  if (isCarWash && canDo("CAR_WASH_OPERATIONS", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/car-wash/operations/new`, label: locale === "en" ? "Daily operations" : "عمليات يومية", color: "cyan", icon: <TrendingUp size={16} /> });

  if (isCarWash && canDo("VEHICLES", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/car-wash/vehicles`, label: locale === "en" ? "Vehicles" : "المركبات", color: "rose", icon: <Car size={16} /> });

  if (isTrading && canDo("INVESTOR_CLAIMS", "CREATE"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/investors/claims/new`, label: locale === "en" ? "Investor claim" : "مطالبة مسئول", color: "emerald", icon: <Users size={16} /> });

  if (canDo("REPORTS", "VIEW"))
    quickLinks.push({ href: `/dashboard/companies/${companyId}/reports`, label: locale === "en" ? "Reports" : "التقارير", color: "amber", icon: <FileText size={16} /> });

  if ((await getUiStyle()) === "modern") {
    const en = locale === "en";
    const typeLabel = companyTypeLabels[locale][company.type as keyof typeof companyTypeLabels.ar] ?? company.type;
    const initial = (companyName.replace(/^\s*(شركة|شركه)\s+/, "").trim() || companyName).charAt(0);
    const kpis: Array<{ label: string; value: number; icon: React.ReactNode; tone?: "warn" | "crit"; href?: string }> = [
      { label: en ? "Total employees" : "إجمالي الموظفين", value: company._count.employees, icon: <Users size={18} /> },
      { label: en ? "Branches" : "الفروع", value: company._count.branches, icon: <Building2 size={18} /> },
      ...(canViewAccounting
        ? [{ label: en ? "Draft entries" : "قيد مسودة", value: unpostedJEs, icon: <Receipt size={18} />, tone: unpostedJEs > 0 ? ("warn" as const) : undefined, href: `/dashboard/companies/${companyId}/accounting/journal-entries` }]
        : []),
      { label: en ? "Residencies expiring (30d)" : "إقامة تنتهي (30 يوم)", value: expiringResidencies.length, icon: <AlertTriangle size={18} />, tone: expiringResidencies.length > 0 ? ("crit" as const) : undefined, href: `/dashboard/companies/${companyId}/hr/expiry-alerts` },
    ];
    const licenseStats: Array<{ label: string; value: number; href?: string; tone?: "warn" }> = [
      { label: en ? "Main licenses" : "التراخيص الرئيسية", value: mainLicensesCount, href: `/dashboard/companies/${companyId}/licenses?type=main` },
      { label: en ? "Sub licenses" : "التراخيص الفرعية", value: subLicensesCount, href: `/dashboard/companies/${companyId}/licenses?type=sub` },
      { label: en ? "Emp. in main licenses" : "موظفو الرئيسية", value: empInMainLicenses },
      { label: en ? "Emp. in sub licenses" : "موظفو الفرعية", value: empInSubLicenses },
      { label: en ? "Licenses expiring (60d)" : "تراخيص تنتهي (60 يوم)", value: expiringLicenses, href: `/dashboard/companies/${companyId}/licenses`, tone: expiringLicenses > 0 ? "warn" : undefined },
    ];
    const toneBox = (tone?: "warn" | "crit") =>
      tone === "crit" ? "border-[#F5C2B8] bg-[#FEF1EC]" : tone === "warn" ? "border-[#F3D48A] bg-[#FFF6E0]" : "border-[#E4E8F0] bg-card";
    const toneText = (tone?: "warn" | "crit") => (tone === "crit" ? "text-[#B42318]" : tone === "warn" ? "text-[#8A5A00]" : "text-[#0F172A]");

    return (
      <div>
        <Header title={companyName} subtitle={typeLabel} companyId={companyId} />

        <div className="page-container flex flex-col gap-5">
          <section className="flex flex-wrap items-center gap-4 rounded-[24px] border border-[#E4E8F0] bg-card p-5">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-[18px] border border-[#E4E8F0] bg-white object-contain p-1" />
            ) : (
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] text-2xl font-extrabold ${companyAvatarClasses(company.type)}`}>{initial}</span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold" title={companyName}>{companyName}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#5B6577]">
                <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 font-bold text-[#3B5BDB]">{typeLabel}</span>
                <span>{company._count.employees} {en ? "employees" : "موظف"}</span>
                <span>•</span>
                <span>{company._count.branches} {en ? "branches" : "فرع"}</span>
                {company.isActive === false ? <span className="rounded-full bg-[#FEF1EC] px-2.5 py-1 font-bold text-[#B42318]">{en ? "Inactive" : "متوقف"}</span> : null}
              </div>
            </div>
            {session.isSuperAdmin ? (
              <details className="company-menu relative">
                <summary aria-label={en ? "Company options" : "خيارات الشركة"} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-[14px] border border-[#E4E8F0] hover:bg-[#F1F4F9] [&::-webkit-details-marker]:hidden">
                  <MoreHorizontal size={18} />
                </summary>
                <div className="absolute z-20 mt-3 w-[min(420px,calc(100vw-64px))] rounded-[18px] border border-[#E4E8F0] bg-card p-4 shadow-lg ltr:right-0 rtl:left-0">
                  <CompanyLogoUpload companyId={companyId} currentLogoUrl={company.logoUrl ?? null} companyName={companyName} isSuperAdmin={session.isSuperAdmin} />
                </div>
              </details>
            ) : null}
          </section>

          {company.type === "CONTRACTING" && (hasPermission(session, "CONTRACTING", "VIEW", { companyId }) || canViewAccounting) && (
            <Link href={`/dashboard/companies/${companyId}/contracting`} className="flex items-center gap-4 rounded-[22px] border border-[#FAD7B5] bg-[#FFF4EA] p-5 hover:bg-[#FFEEDD]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#C2410C]"><Building2 size={20} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block">{en ? "Contracting projects" : "مشروعات المقاولات"}</strong>
                <span className="text-sm text-[#5B6577]">{en ? "Projects, contracts, certificates, costs and site logs" : "المشروعات والعقود والمستخلصات والتكاليف وسجل الموقع"}</span>
              </span>
              <ChevronLeft size={18} className="text-[#94A3B8] ltr:rotate-180" />
            </Link>
          )}

          {canViewAccounting && unpostedJEs > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-[#F3D48A] bg-[#FFF6E0] p-4 text-[#5C3D00]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#8A5A00]"><AlertTriangle size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{en ? "There are unposted journal entries that need review." : "يوجد قيود غير مرحلة تحتاج مراجعة."}</p>
                <p className="text-sm">
                  {en
                    ? `${unpostedJEs} entries are still draft, pending approval, or approved without posting.`
                    : `${unpostedJEs} قيدًا ما زال في حالة مسودة أو بانتظار اعتماد أو معتمد بدون ترحيل.`}
                </p>
              </div>
              <Link href={`/dashboard/companies/${companyId}/accounting/journal-entries`} className="shrink-0 rounded-[14px] border border-[#E9C46A] bg-white px-4 py-2.5 text-sm font-bold hover:bg-[#FFF1CC]">
                {en ? "Review entries" : "مراجعة القيود"}
              </Link>
            </div>
          )}

          <section aria-label={en ? "Key figures" : "المؤشرات"} className={`grid grid-cols-2 gap-3 ${kpis.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {kpis.map((kpi) => {
              const body = (
                <div className={`flex h-full flex-col gap-3 rounded-[22px] border p-5 ${toneBox(kpi.tone)}`}>
                  <span className="flex items-center justify-between text-sm text-[#5B6577]">
                    {kpi.label}
                    <span className={`flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/70 ${toneText(kpi.tone)}`}>{kpi.icon}</span>
                  </span>
                  <span className={`text-3xl font-extrabold number ${toneText(kpi.tone)}`}>{String(kpi.value)}</span>
                </div>
              );
              return kpi.href ? <Link key={kpi.label} href={kpi.href} className="block">{body}</Link> : <div key={kpi.label}>{body}</div>;
            })}
          </section>

          <section className="rounded-[24px] border border-[#E4E8F0] bg-card p-5">
            <h2 className="mb-4 text-lg font-extrabold">{en ? "Licenses overview" : "نظرة عامة على التراخيص"}</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {licenseStats.map((stat) => {
                const body = (
                  <div className={`flex h-full flex-col gap-1 rounded-[16px] px-4 py-3 ${stat.tone === "warn" ? "bg-[#FFF6E0]" : "bg-[#F8FAFC]"} ${stat.href ? "hover:bg-[#EEF2FF]" : ""}`}>
                    <span className="text-xs text-[#5B6577]">{stat.label}</span>
                    <span className={`text-2xl font-extrabold number ${stat.tone === "warn" ? "text-[#8A5A00]" : ""}`}>{String(stat.value)}</span>
                  </div>
                );
                return stat.href ? <Link key={stat.label} href={stat.href} className="block">{body}</Link> : <div key={stat.label}>{body}</div>;
              })}
            </div>
          </section>

          {quickLinks.length > 0 && (
            <section className="rounded-[24px] border border-[#E4E8F0] bg-card p-5">
              <h2 className="mb-4 text-lg font-extrabold">{en ? "Quick actions" : "إجراءات سريعة"}</h2>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                {quickLinks.map((link: QuickLink) => (
                  <Link key={link.href} href={link.href} className="flex min-h-12 items-center gap-2.5 rounded-[14px] border border-[#E4E8F0] px-3 text-sm font-bold text-[#0F172A] hover:border-[#C7D2FE] hover:bg-[#F5F7FF]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FF] text-[#3B5BDB]">{link.icon}</span>
                    <span className="truncate">{link.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className={`grid grid-cols-1 gap-5 ${canViewAccounting ? "lg:grid-cols-2" : ""}`}>
            {canViewAccounting && (
              <section className="rounded-[24px] border border-[#E4E8F0] bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">{en ? "Recent journal entries" : "آخر القيود"}</h2>
                  <Link href={`/dashboard/companies/${companyId}/accounting/journal-entries`} className="text-sm font-bold text-primary hover:underline">{en ? "View all" : "عرض الكل"}</Link>
                </div>
                {recentJEs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{en ? "No journal entries yet" : "لا توجد قيود"}</p>
                ) : (
                  <div className="divide-y divide-[#EEF0F4]">
                    {recentJEs.map((entry: RecentJournalEntryRow) => (
                      <Link key={entry.id} href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#F8FAFC]">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{entry.number}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{en ? entry.descriptionEn ?? entry.descriptionAr : entry.descriptionAr}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.date, dateLocale)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <p className="font-extrabold number text-[#0F172A]">{formatKWD(Number(entry.totalDebit), numberLocale)}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs status-${entry.status.toLowerCase()}`}>
                            {journalStatusLabels[locale][entry.status as keyof typeof journalStatusLabels.ar]}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-[24px] border border-[#E4E8F0] bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">{en ? "Residency alerts (30 days)" : "تنبيهات الإقامات (30 يوم)"}</h2>
                <Link href={`/dashboard/companies/${companyId}/hr/expiry-alerts`} className="text-sm font-bold text-primary hover:underline">{en ? "View all" : "عرض الكل"}</Link>
              </div>
              {expiringResidencies.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{en ? "No residencies expiring in the next 30 days" : "لا توجد إقامات منتهية خلال 30 يوم"}</p>
              ) : (
                <div className="divide-y divide-[#EEF0F4]">
                  {expiringResidencies.map((employee: ExpiringResidencyRow, index: number) => {
                    const days = daysUntilExpiry(employee.residencyExpiry);
                    const employeeName = en ? employee.nameEn ?? employee.nameAr : employee.nameAr;
                    const tone = days !== null && days <= 7 ? "bg-[#FEF1EC] text-[#B42318]" : days !== null && days <= 15 ? "bg-[#FFF1E6] text-[#B54708]" : "bg-[#FFF6E0] text-[#8A5A00]";
                    return (
                      <div key={`${employee.nameAr}-${index}`} className="flex items-center gap-3 py-3">
                        <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] ${tone}`}>
                          <span className="text-base font-extrabold leading-none">{days ?? "-"}</span>
                          <span className="text-[10px]">{en ? "days" : "يوم"}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{employeeName}</p>
                          <p className="text-xs text-muted-foreground">{employee.residencyExpiry ? formatDate(employee.residencyExpiry, dateLocale) : "-"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={companyName}
        subtitle={companyTypeLabels[locale][company.type as keyof typeof companyTypeLabels.ar] ?? company.type}
        companyId={companyId}
      />

      <div className="page-container space-y-6">
        {company.type === "CONTRACTING" && (hasPermission(session, "CONTRACTING", "VIEW", { companyId }) || canViewAccounting) && (
          <Link href={`/dashboard/companies/${companyId}/contracting`} className="section-card block border-orange-200 bg-orange-50">
            <strong>{locale === "en" ? "Contracting projects" : "مشروعات المقاولات"}</strong>
            <p>{locale === "en" ? "Projects, contracts, certificates, costs and site logs" : "المشروعات والعقود والمستخلصات والتكاليف وسجل الموقع"}</p>
          </Link>
        )}

        {/* ── شعار الشركة (مشرف عام فقط) ── */}
        {session.isSuperAdmin && (
          <div className="section-card">
            <CompanyLogoUpload
              companyId={companyId}
              currentLogoUrl={company.logoUrl ?? null}
              companyName={companyName}
              isSuperAdmin={session.isSuperAdmin}
            />
          </div>
        )}

        {/* ── الإحصائيات الرئيسية ── */}
        {canViewAccounting && unpostedJEs > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold">
                    {locale === "en" ? "There are unposted journal entries that need review." : "يوجد قيود غير مرحلة تحتاج مراجعة."}
                  </p>
                  <p className="text-sm">
                    {locale === "en"
                      ? `${unpostedJEs} entries are still draft, pending approval, or approved without posting.`
                      : `${unpostedJEs} قيدًا ما زال في حالة مسودة أو بانتظار اعتماد أو معتمد بدون ترحيل.`}
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard/companies/${companyId}/accounting/journal-entries`}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                {locale === "en" ? "Review entries" : "مراجعة القيود"}
              </Link>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-2 gap-3 ${canViewAccounting ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <StatCard
            icon={<Users size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            value={String(company._count.employees)}
            label={locale === "en" ? "Total employees" : "إجمالي الموظفين"}
          />
          <StatCard
            icon={<Building2 size={20} className="text-green-600" />}
            iconBg="bg-green-50"
            value={String(company._count.branches)}
            label={locale === "en" ? "Branches" : "الفروع"}
          />
          {canViewAccounting && (
            <StatCard
              icon={<Receipt size={20} className="text-yellow-600" />}
              iconBg="bg-yellow-50"
              value={String(unpostedJEs)}
              label={locale === "en" ? "Draft entries" : "قيد مسودة"}
            />
          )}
          <StatCard
            icon={<AlertTriangle size={20} className="text-red-600" />}
            iconBg="bg-red-50"
            value={String(expiringResidencies.length)}
            label={locale === "en" ? "Residencies expiring (30d)" : "إقامة تنتهي (30 يوم)"}
            alert={expiringResidencies.length > 0}
          />
        </div>

        {/* ── إحصائيات التراخيص ── */}
        <div>
          <h2 className="mb-3 text-base font-bold">{locale === "en" ? "Licenses overview" : "نظرة عامة على التراخيص"}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <StatCard
              icon={<ShieldCheck size={20} className="text-violet-600" />}
              iconBg="bg-violet-50"
              value={String(mainLicensesCount)}
              label={locale === "en" ? "Main licenses" : "التراخيص الرئيسية"}
              href={`/dashboard/companies/${companyId}/licenses?type=main`}
            />
            <StatCard
              icon={<ShieldCheck size={20} className="text-indigo-600" />}
              iconBg="bg-indigo-50"
              value={String(subLicensesCount)}
              label={locale === "en" ? "Sub licenses" : "التراخيص الفرعية"}
              href={`/dashboard/companies/${companyId}/licenses?type=sub`}
            />
            <StatCard
              icon={<Users size={20} className="text-violet-600" />}
              iconBg="bg-violet-50"
              value={String(empInMainLicenses)}
              label={locale === "en" ? "Emp. in main licenses" : "موظفو الرئيسية"}
            />
            <StatCard
              icon={<Users size={20} className="text-indigo-600" />}
              iconBg="bg-indigo-50"
              value={String(empInSubLicenses)}
              label={locale === "en" ? "Emp. in sub licenses" : "موظفو الفرعية"}
            />
            <StatCard
              icon={<AlertTriangle size={20} className="text-amber-600" />}
              iconBg="bg-amber-50"
              value={String(expiringLicenses)}
              label={locale === "en" ? "Licenses expiring (60d)" : "تراخيص تنتهي (60 يوم)"}
              alert={expiringLicenses > 0}
              href={`/dashboard/companies/${companyId}/licenses`}
            />
          </div>
        </div>

        {/* ── الروابط السريعة ── */}
        {quickLinks.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold">{locale === "en" ? "Quick actions" : "إجراءات سريعة"}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {quickLinks.map((link: QuickLink) => (
                <QuickAction key={link.href} {...link} />
              ))}
            </div>
          </div>
        )}

        {/* ── آخر القيود + تنبيهات الإقامات ── */}
        <div className={`grid grid-cols-1 gap-6 ${canViewAccounting ? "lg:grid-cols-2" : ""}`}>
          {canViewAccounting && (
            <div className="section-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">{locale === "en" ? "Recent journal entries" : "آخر القيود"}</h3>
                <Link href={`/dashboard/companies/${companyId}/accounting/journal-entries`} className="text-xs text-primary hover:underline">
                  {locale === "en" ? "View all" : "عرض الكل"}
                </Link>
              </div>
              <div className="space-y-2">
                {recentJEs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {locale === "en" ? "No journal entries yet" : "لا توجد قيود"}
                  </p>
                ) : (
                  recentJEs.map((entry: RecentJournalEntryRow) => (
                    <Link
                      key={entry.id}
                      href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}`}
                      className="flex items-center justify-between rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/60"
                    >
                      <div>
                        <p className="text-sm font-medium">{entry.number}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {locale === "en" ? entry.descriptionEn ?? entry.descriptionAr : entry.descriptionAr}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(entry.date, dateLocale)}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold number text-blue-600">{formatKWD(Number(entry.totalDebit), numberLocale)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs status-${entry.status.toLowerCase()}`}>
                          {journalStatusLabels[locale][entry.status as keyof typeof journalStatusLabels.ar]}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="section-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">{locale === "en" ? "Residency alerts (30 days)" : "تنبيهات الإقامات (30 يوم)"}</h3>
              <Link href={`/dashboard/companies/${companyId}/hr/expiry-alerts`} className="text-xs text-primary hover:underline">
                {locale === "en" ? "View all" : "عرض الكل"}
              </Link>
            </div>
            <div className="space-y-2">
              {expiringResidencies.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {locale === "en" ? "No residencies expiring in the next 30 days" : "لا توجد إقامات منتهية خلال 30 يوم"}
                </p>
              ) : (
                expiringResidencies.map((employee: ExpiringResidencyRow, index: number) => {
                  const days = daysUntilExpiry(employee.residencyExpiry);
                  const employeeName = locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr;
                  return (
                    <div key={`${employee.nameAr}-${index}`} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{employeeName}</p>
                        <p className="text-xs text-muted-foreground">{employee.residencyExpiry ? formatDate(employee.residencyExpiry, dateLocale) : "-"}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          days !== null && days <= 7
                            ? "bg-red-100 text-red-700"
                            : days !== null && days <= 15
                            ? "bg-orange-100 text-orange-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {days !== null ? `${days} ${locale === "en" ? "day(s)" : "يوم"}` : "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  alert,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  alert?: boolean;
  href?: string;
}) {
  const inner = (
    <div className={`stat-card transition-colors ${href ? "hover:border-primary/30 cursor-pointer" : ""} ${alert ? "border-red-200 bg-red-50/30" : ""}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function QuickAction({
  href,
  label,
  icon,
  color,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue:    "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    indigo:  "border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    purple:  "border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100",
    cyan:    "border-cyan-100 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    orange:  "border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100",
    green:   "border-green-100 bg-green-50 text-green-700 hover:bg-green-100",
    violet:  "border-violet-100 bg-violet-50 text-violet-700 hover:bg-violet-100",
    teal:    "border-teal-100 bg-teal-50 text-teal-700 hover:bg-teal-100",
    slate:   "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100",
    sky:     "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100",
    rose:    "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100",
    amber:   "border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100",
  };

  return (
    <Link href={href} className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${colors[color] ?? colors.slate}`}>
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
