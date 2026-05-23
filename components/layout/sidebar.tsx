"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Paperclip,
  Receipt,
  Settings,
  Shield,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getVisibleModules, hasPermission, type Module } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/types";
import { useLocale } from "@/components/providers/locale-provider";

interface CompanyNavContext {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  module?: Module;
  children?: NavItem[];
}

const GROUP_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.groupDashboard", icon: <LayoutDashboard size={18} />, module: "DASHBOARD" },
  { href: "/dashboard/companies", labelKey: "nav.companies", icon: <Building2 size={18} />, module: "COMPANIES" },
  { href: "/dashboard/users", labelKey: "nav.users", icon: <Users size={18} />, module: "USERS" },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: <Settings size={18} />, module: "SETTINGS" },
  { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: <Bell size={18} />, module: "NOTIFICATIONS" },
];

function buildCompanyNav(base: string): NavItem[] {
  return [
    { href: base, labelKey: "nav.dashboard", icon: <LayoutDashboard size={18} />, module: "DASHBOARD" },
    { href: `${base}/administrative-affairs`, labelKey: "nav.administrativeAffairs", icon: <FileText size={18} />, module: "ADMINISTRATIVE_AFFAIRS" },
    { href: `${base}/licenses`, labelKey: "nav.licenses", icon: <FileText size={18} />, module: "LICENSES" },
    { href: `${base}/vehicles`, labelKey: "nav.vehicles", icon: <Car size={18} />, module: "VEHICLES" },
    {
      href: `${base}/accounting`,
      labelKey: "nav.accounting",
      icon: <BookOpen size={18} />,
      module: "ACCOUNTING",
      children: [
        { href: `${base}/accounting/receipts`, labelKey: "nav.receipts", icon: <ArrowDownToLine size={16} /> },
        { href: `${base}/accounting/payments`, labelKey: "nav.payments", icon: <ArrowUpFromLine size={16} /> },
        { href: `${base}/accounting/journal-entries`, labelKey: "nav.journalEntries", icon: <FileText size={16} /> },
        { href: `${base}/accounting/end-of-service`, labelKey: "nav.endOfService", icon: <Wallet size={16} /> },
        { href: `${base}/accounting/leave-pay`, labelKey: "nav.leavePay", icon: <Receipt size={16} /> },
        { href: `${base}/accounting/accounts`, labelKey: "nav.accounts", icon: <Receipt size={16} /> },
        { href: `${base}/accounting/bank-accounts`, labelKey: "nav.bankAccounts", icon: <Wallet size={16} /> },
        { href: `${base}/accounting/fiscal-years`, labelKey: "nav.fiscalYears", icon: <BookOpen size={16} /> },
        { href: `${base}/accounting/reports/trial-balance`, labelKey: "nav.trialBalance", icon: <BarChart3 size={16} /> },
        { href: `${base}/accounting/reports/income-statement`, labelKey: "nav.incomeStatement", icon: <TrendingUp size={16} /> },
        { href: `${base}/accounting/reports/balance-sheet`, labelKey: "nav.balanceSheet", icon: <BarChart3 size={16} /> },
      ],
    },
    {
      href: `${base}/delivery`,
      labelKey: "nav.deliveryOperations",
      icon: <Truck size={18} />,
      module: "DELIVERY_OPERATIONS",
      children: [
        { href: `${base}/delivery/contracts`, labelKey: "nav.deliveryContracts", icon: <FileText size={16} /> },
        { href: `${base}/delivery/drivers`, labelKey: "nav.deliveryDrivers", icon: <Users size={16} /> },
        { href: `${base}/delivery/daily-orders`, labelKey: "nav.dailyOrders", icon: <Receipt size={16} /> },
        { href: `${base}/delivery/monthly-reports`, labelKey: "nav.monthlyReports", icon: <FileText size={16} /> },
        { href: `${base}/delivery/wallet`, labelKey: "nav.driverWallets", icon: <Wallet size={16} /> },
        { href: `${base}/delivery/payments`, labelKey: "nav.companyPayments", icon: <BarChart3 size={16} /> },
      ],
    },
    {
      href: `${base}/car-wash`,
      labelKey: "nav.carWashOperations",
      icon: <Car size={18} />,
      module: "CAR_WASH_OPERATIONS",
      children: [
        { href: `${base}/car-wash/vehicles`, labelKey: "nav.carWashVehicles", icon: <Car size={16} /> },
        { href: `${base}/car-wash/operations`, labelKey: "nav.carWashDailyOperations", icon: <Receipt size={16} /> },
        { href: `${base}/car-wash/knet`, labelKey: "nav.knet", icon: <Wallet size={16} /> },
        { href: `${base}/car-wash/profitability`, labelKey: "nav.profitability", icon: <TrendingUp size={16} /> },
      ],
    },
    {
      href: `${base}/investors`,
      labelKey: "nav.investors",
      icon: <Building2 size={18} />,
      module: "INVESTORS",
      children: [
        { href: `${base}/investors`, labelKey: "nav.investors", icon: <Users size={16} /> },
        { href: `${base}/investors/branches`, labelKey: "nav.investorBranches", icon: <Building2 size={16} /> },
        { href: `${base}/investors/claims`, labelKey: "nav.investorClaims", icon: <FileText size={16} /> },
        { href: `${base}/investors/statements`, labelKey: "nav.investorStatements", icon: <FileText size={16} /> },
        { href: `${base}/investors/salaries`, labelKey: "nav.investorSalaries", icon: <Wallet size={16} /> },
      ],
    },
    {
      href: `${base}/hr`,
      labelKey: "nav.employees",
      icon: <Users size={18} />,
      module: "HR",
      children: [
        { href: `${base}/hr/employees`, labelKey: "nav.employees", icon: <Users size={16} /> },
        { href: `${base}/hr/positions`, labelKey: "nav.positions", icon: <FileText size={16} /> },
        { href: `${base}/hr/salaries`, labelKey: "nav.salaries", icon: <Wallet size={16} /> },
        { href: `${base}/hr/tickets`, labelKey: "nav.tickets", icon: <FileText size={16} /> },
        { href: `${base}/hr/expiry-alerts`, labelKey: "nav.expiryAlerts", icon: <BarChart3 size={16} /> },
      ],
    },
    { href: `${base}/expenses`, labelKey: "nav.expenses", icon: <Receipt size={18} />, module: "EXPENSES" },
    { href: `${base}/reports`, labelKey: "nav.reports", icon: <BarChart3 size={18} />, module: "REPORTS" },
    { href: `${base}/attachments`, labelKey: "nav.attachments", icon: <Paperclip size={18} />, module: "ATTACHMENTS" },
    { href: `${base}/assets`, labelKey: "nav.assets", icon: <Package size={18} />, module: "ASSETS_CUSTODY" },
  ];
}

function filterGroupNav(user: SessionUser, items: NavItem[]) {
  return items.filter((item) => {
    if (item.href === "/dashboard") return true;
    if (item.module === "USERS") return user.isSuperAdmin || hasPermission(user, "USERS", "VIEW");
    if (item.module === "SETTINGS") return user.isSuperAdmin || hasPermission(user, "SETTINGS", "VIEW");
    if (item.module === "COMPANIES") return user.isSuperAdmin || user.companyAccess.length > 0;
    if (item.module === "NOTIFICATIONS") return true;
    return true;
  });
}

function filterCompanyNav(user: SessionUser, company: CompanyNavContext, items: NavItem[]) {
  const visibleModules = new Set(getVisibleModules(user, company.type));
  return items.filter((item) => {
    if (!item.module) return true;
    if (!visibleModules.has(item.module)) return false;

    if (item.module === "HR" && company.type === "DELIVERY") {
      return hasPermission(user, "HR", "VIEW", { companyId: company.id }) ||
        hasPermission(user, "DELIVERY_HR", "VIEW", { companyId: company.id });
    }

    if (item.module === "HR" && company.type === "CAR_WASH") {
      return hasPermission(user, "HR", "VIEW", { companyId: company.id }) ||
        hasPermission(user, "CAR_WASH_HR", "VIEW", { companyId: company.id });
    }

    return hasPermission(user, item.module, "VIEW", { companyId: company.id });
  });
}

interface SidebarProps {
  userName?: string;
  session: SessionUser;
  companies: CompanyNavContext[];
}

export function Sidebar({ userName, session, companies }: SidebarProps) {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const companyMatch = pathname.match(/\/dashboard\/companies\/([^/]+)/);
    setResolvedCompanyId(companyMatch?.[1] ?? null);
  }, [pathname]);

  const currentCompany = useMemo(
    () => companies.find((company) => company.id === resolvedCompanyId),
    [companies, resolvedCompanyId],
  );

  const navItems = useMemo(() => {
    if (!mounted || !currentCompany) {
      return filterGroupNav(session, GROUP_NAV);
    }
    return filterCompanyNav(session, currentCompany, buildCompanyNav(`/dashboard/companies/${currentCompany.id}`));
  }, [mounted, currentCompany, session]);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    setExpandedItems(navItems.filter((item) => item.children?.length).map((item) => item.href));
  }, [navItems]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function toggleExpand(href: string) {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((entry) => entry !== href) : [...prev, href],
    );
  }

  const companySubtitle = mounted && currentCompany
    ? (locale === "en" ? currentCompany.nameEn ?? currentCompany.nameAr : currentCompany.nameAr)
    : (locale === "en" ? "Access is filtered by company and group" : "الصلاحيات حسب الشركة والمجموعة");

  return (
    <aside className="app-sidebar fixed top-0 z-40 flex h-full w-64 flex-col bg-sidebar shadow-xl">
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <span className="text-lg font-bold text-white">ر</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">{t("system.name")}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{companySubtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            isExpanded={expandedItems.includes(item.href)}
            onToggle={() => toggleExpand(item.href)}
          />
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {userName && (
          <p className="px-3 pb-1 text-xs text-sidebar-foreground/60">{userName}</p>
        )}
        {session.isSuperAdmin && (
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-sidebar-foreground/60">
            <Shield size={12} />
            <span>{t("system.superAdmin")}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut size={16} className="shrink-0" />
          <span>{t("system.logout")}</span>
        </button>
      </div>
    </aside>
  );
}

function NavItemComponent({
  item,
  pathname,
  isExpanded,
  onToggle,
}: {
  item: NavItem;
  pathname: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggle}
          className={cn(
            "mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1 text-right">{t(item.labelKey)}</span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
        </button>

        {isExpanded && (
          <div className="mb-1 mr-4 space-y-0.5 border-r border-sidebar-border/30 pr-2">
            {item.children!.map((child) => (
              <NavItemComponent
                key={child.href}
                item={child}
                pathname={pathname}
                isExpanded={false}
                onToggle={() => undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}
