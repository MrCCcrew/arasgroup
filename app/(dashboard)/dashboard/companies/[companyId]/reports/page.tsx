import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Car,
  FileText,
  Scale,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function ReportsPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true, type: true },
  });

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { companyId, isCurrent: true },
  });

  const companyName = company
    ? locale === "en"
      ? company.nameEn ?? company.nameAr
      : company.nameAr
    : "";

  const base = `/dashboard/companies/${companyId}`;

  const accountingReports = [
    {
      title: locale === "en" ? "Trial Balance" : "ميزان المراجعة",
      description: locale === "en" ? "Balances of all accounts in the selected period" : "أرصدة جميع الحسابات في الفترة المحددة",
      href: `${base}/accounting/reports/trial-balance`,
      icon: Scale,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: locale === "en" ? "Income Statement" : "قائمة الدخل",
      description: locale === "en" ? "Revenue, expenses, and net profit" : "الإيرادات والمصروفات وصافي الربح",
      href: `${base}/accounting/reports/income-statement`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: locale === "en" ? "Balance Sheet" : "الميزانية العمومية",
      description: locale === "en" ? "Assets, liabilities, and equity" : "الأصول والالتزامات وحقوق الملكية",
      href: `${base}/accounting/reports/balance-sheet`,
      icon: BookOpen,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const hrReports = [
    {
      title: locale === "en" ? "Expiry Alerts" : "تنبيهات الانتهاء",
      description: locale === "en" ? "Expired or soon-to-expire residencies and licenses" : "الإقامات والرخص المنتهية أو القريبة من الانتهاء",
      href: `${base}/hr/expiry-alerts`,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: locale === "en" ? "Travel Tickets" : "تذاكر السفر",
      description: locale === "en" ? "Employee ticket records and costs" : "سجل تذاكر الموظفين والتكاليف",
      href: `${base}/hr/tickets`,
      icon: FileText,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
  ];

  const deliveryReports = [
    {
      title: locale === "en" ? "Monthly Reports" : "التقارير الشهرية",
      description: locale === "en" ? "Monthly summary of delivery orders and payments" : "ملخص أوامر التوصيل والمدفوعات شهرياً",
      href: `${base}/delivery/monthly-reports`,
      icon: BarChart3,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      title: locale === "en" ? "Driver Wallets" : "محفظة السائقين",
      description: locale === "en" ? "Driver wallet balances and transactions" : "أرصدة محافظ السائقين والمعاملات",
      href: `${base}/delivery/wallet`,
      icon: Truck,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  const carWashReports = [
    {
      title: locale === "en" ? "Vehicle Profitability" : "ربحية المركبات",
      description: locale === "en" ? "Compare monthly performance of wash vehicles" : "مقارنة أداء مركبات الغسيل شهرياً",
      href: `${base}/car-wash/profitability`,
      icon: Car,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: locale === "en" ? "KNET Settlements" : "تسوية KNET",
      description: locale === "en" ? "Electronic payment settlement records" : "سجل تسويات مبالغ الدفع الإلكتروني",
      href: `${base}/car-wash/knet`,
      icon: BarChart3,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div>
      <Header
        title={locale === "en" ? "Reports" : "التقارير"}
        subtitle={`${companyName} - ${locale === "en" ? "Fiscal year" : "السنة المالية"} ${fiscalYear?.year ?? "-"}`}
        companyId={companyId}
      />

      <div className="page-container space-y-8">
        <ReportSection
          title={locale === "en" ? "Accounting Reports" : "التقارير المالية والمحاسبية"}
          items={accountingReports}
        />

        <ReportSection
          title={locale === "en" ? "Human Resources Reports" : "تقارير الموارد البشرية"}
          items={hrReports}
        />

        {company?.type === "DELIVERY" && (
          <ReportSection
            title={locale === "en" ? "Delivery Reports" : "تقارير التوصيل"}
            items={deliveryReports}
          />
        )}

        {company?.type === "CAR_WASH" && (
          <ReportSection
            title={locale === "en" ? "Car Wash Reports" : "تقارير غسيل السيارات"}
            items={carWashReports}
          />
        )}
      </div>
    </div>
  );
}

function ReportSection({
  title,
  items,
}: {
  title: string;
  items: Array<{
    title: string;
    description: string;
    href: string;
    icon: typeof BarChart3;
    color: string;
    bg: string;
  }>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="section-card group transition-shadow hover:shadow-md">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon size={20} className={item.color} />
            </div>
            <h3 className="mb-1 font-bold transition-colors group-hover:text-primary">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
