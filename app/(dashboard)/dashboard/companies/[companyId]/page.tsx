import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
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

  const pendingJEs = await prisma.journalEntry.count({
    where: { companyId, status: "DRAFT", isDeleted: false },
  });

  const expiringResidencies = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      isDeleted: false,
      residencyExpiry: {
        lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        gte: new Date(),
      },
    },
    select: { nameAr: true, nameEn: true, residencyExpiry: true },
    orderBy: { residencyExpiry: "asc" },
    take: 5,
  });

  const recentJEs = await prisma.journalEntry.findMany({
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
  });

  const isDelivery = company.type === "DELIVERY";
  const isCarWash = company.type === "CAR_WASH";
  const isTrading = company.type === "TRADING";
  const companyName = locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr;

  return (
    <div>
      <Header
        title={companyName}
        subtitle={companyTypeLabels[locale][company.type as keyof typeof companyTypeLabels.ar] ?? company.type}
        companyId={companyId}
      />

      <div className="page-container space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<Users size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            value={String(company._count.employees)}
            label={locale === "en" ? "Active employees" : "موظف نشط"}
          />
          <StatCard
            icon={<Building2 size={20} className="text-green-600" />}
            iconBg="bg-green-50"
            value={String(company._count.branches)}
            label={locale === "en" ? "Branches" : "فرع"}
          />
          <StatCard
            icon={<Receipt size={20} className="text-yellow-600" />}
            iconBg="bg-yellow-50"
            value={String(pendingJEs)}
            label={locale === "en" ? "Draft entries" : "قيد مسودة"}
          />
          <StatCard
            icon={<AlertTriangle size={20} className="text-red-600" />}
            iconBg="bg-red-50"
            value={String(expiringResidencies.length)}
            label={locale === "en" ? "Residencies expiring soon" : "إقامة تنتهي قريباً"}
          />
        </div>

        <div>
          <h2 className="mb-3 text-base font-bold">{locale === "en" ? "Quick actions" : "إجراءات سريعة"}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <QuickAction href={`/dashboard/companies/${companyId}/accounting/journal-entries/new`} label={locale === "en" ? "New journal entry" : "قيد جديد"} color="blue" icon={<Receipt size={18} />} />
            {isDelivery && <QuickAction href={`/dashboard/companies/${companyId}/delivery/daily-orders/new`} label={locale === "en" ? "Daily order" : "أوردر يومي"} color="indigo" icon={<TrendingUp size={18} />} />}
            {isDelivery && <QuickAction href={`/dashboard/companies/${companyId}/delivery/wallet`} label={locale === "en" ? "Driver wallets" : "محفظة السائقين"} color="purple" icon={<Wallet size={18} />} />}
            {isCarWash && <QuickAction href={`/dashboard/companies/${companyId}/car-wash/operations`} label={locale === "en" ? "Daily operations" : "عمليات يومية"} color="cyan" icon={<TrendingUp size={18} />} />}
            {isTrading && <QuickAction href={`/dashboard/companies/${companyId}/investors/claims/new`} label={locale === "en" ? "Investor claim" : "مطالبة مستثمر"} color="emerald" icon={<Users size={18} />} />}
            <QuickAction href={`/dashboard/companies/${companyId}/expenses/new`} label={locale === "en" ? "New expense" : "مصروف جديد"} color="orange" icon={<Receipt size={18} />} />
            <QuickAction href={`/dashboard/companies/${companyId}/hr/employees/new`} label={locale === "en" ? "New employee" : "موظف جديد"} color="green" icon={<Users size={18} />} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                recentJEs.map((entry) => (
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
                        {journalStatusLabels[locale][entry.status]}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">{locale === "en" ? "Residency alerts" : "تنبيهات الإقامات"}</h3>
              <Link href={`/dashboard/companies/${companyId}/hr/expiry-alerts`} className="text-xs text-primary hover:underline">
                {locale === "en" ? "View all" : "عرض الكل"}
              </Link>
            </div>
            <div className="space-y-2">
              {expiringResidencies.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {locale === "en" ? "No residencies expiring soon" : "لا توجد إقامات منتهية قريباً"}
                </p>
              ) : (
                expiringResidencies.map((employee, index) => {
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
                          days !== null && days <= 30 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
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
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
}) {
  return (
    <div className="stat-card">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
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
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    purple: "border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100",
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    orange: "border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100",
    green: "border-green-100 bg-green-50 text-green-700 hover:bg-green-100",
  };

  return (
    <Link href={href} className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${colors[color]}`}>
      {icon}
      {label}
    </Link>
  );
}
