import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Car,
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

interface Props {
  params: Promise<{ companyId: string }>;
}

const companyTypeLabels = {
  ar: {
    DELIVERY: "توصيل",
    CAR_WASH: "غسيل سيارات",
    TRADING: "تجارة عامة",
    GENERAL_TRADING: "تجارة عامة",
    HOLDING: "قابضة",
    OTHER: "أخرى",
  },
  en: {
    DELIVERY: "Delivery",
    CAR_WASH: "Car Wash",
    TRADING: "General Trading",
    GENERAL_TRADING: "General Trading",
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

  return (
    <div>
      <Header
        title={companyName}
        subtitle={companyTypeLabels[locale][company.type as keyof typeof companyTypeLabels.ar] ?? company.type}
        companyId={companyId}
      />

      <div className="page-container space-y-6">

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
