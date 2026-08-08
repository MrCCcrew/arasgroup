"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AlarmClock,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Monitor,
  Package,
  Paperclip,
  Receipt,
  Search,
  Settings,
  Shield,
  TrendingUp,
  Truck,
  UserRoundPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
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
  iconColor?: string;
  module?: Module;
  children?: NavItem[];
  adminOnly?: boolean;
}

// Section color schemes
const C = {
  blue: { bg: "bg-blue-500/20", text: "text-blue-400", active: "bg-blue-500/25 border-blue-400" },
  violet: { bg: "bg-violet-500/20", text: "text-violet-400", active: "bg-violet-500/25 border-violet-400" },
  amber: { bg: "bg-amber-500/20", text: "text-amber-400", active: "bg-amber-500/25 border-amber-400" },
  slate: { bg: "bg-slate-500/20", text: "text-slate-300", active: "bg-slate-500/25 border-slate-300" },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", active: "bg-emerald-500/25 border-emerald-400" },
  indigo: { bg: "bg-indigo-500/20", text: "text-indigo-400", active: "bg-indigo-500/25 border-indigo-400" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400", active: "bg-cyan-500/25 border-cyan-400" },
  teal: { bg: "bg-teal-500/20", text: "text-teal-400", active: "bg-teal-500/25 border-teal-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400", active: "bg-orange-500/25 border-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400", active: "bg-red-500/25 border-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400", active: "bg-purple-500/25 border-purple-400" },
  rose: { bg: "bg-rose-500/20", text: "text-rose-400", active: "bg-rose-500/25 border-rose-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400", active: "bg-green-500/25 border-green-400" },
  sky: { bg: "bg-sky-500/20", text: "text-sky-400", active: "bg-sky-500/25 border-sky-400" },
} as const;

type ColorKey = keyof typeof C;

const GROUP_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.groupDashboard", icon: <LayoutDashboard size={16} />, iconColor: "blue" },
  { href: "/dashboard/search", labelKey: "nav.globalSearch", icon: <Search size={16} />, iconColor: "amber" },
  { href: "/dashboard/companies", labelKey: "nav.companies", icon: <Building2 size={16} />, iconColor: "teal" },
  { href: "/dashboard/users", labelKey: "nav.users", icon: <Users size={16} />, iconColor: "violet", module: "USERS" },
  { href: "/dashboard/completed-tasks", labelKey: "nav.completedTasks", icon: <ClipboardCheck size={16} />, iconColor: "green", module: "TASKS" },
  { href: "/dashboard/activity-monitor", labelKey: "nav.auditLogs", icon: <Monitor size={16} />, iconColor: "purple", module: "AUDIT_LOGS" },
  { href: "/dashboard/reminders", labelKey: "nav.reminders", icon: <AlarmClock size={16} />, iconColor: "amber" },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: <Settings size={16} />, iconColor: "slate", module: "SETTINGS" },
  { href: "/dashboard/notifications", labelKey: "nav.notifications", icon: <Bell size={16} />, iconColor: "rose", module: "NOTIFICATIONS" },
];

function buildCompanyNav(base: string): NavItem[] {
  return [
    { href: base, labelKey: "nav.dashboard", icon: <LayoutDashboard size={16} />, iconColor: "blue", module: "DASHBOARD" },
    {
      href: `${base}/administrative-affairs`,
      labelKey: "nav.administrativeAffairs",
      icon: <FileText size={16} />,
      iconColor: "violet",
      module: "ADMINISTRATIVE_AFFAIRS",
      children: [
        { href: `${base}/licenses`, labelKey: "nav.licenses", icon: <FileText size={14} />, iconColor: "amber" },
        { href: `${base}/vehicles`, labelKey: "nav.vehicles", icon: <Car size={14} />, iconColor: "slate" },
        {
          href: `${base}/hr/employees`,
          labelKey: "nav.employees",
          icon: <Users size={14} />,
          iconColor: "orange",
          children: [
            { href: `${base}/hr/positions`, labelKey: "nav.positions", icon: <FileText size={14} />, iconColor: "orange" },
            { href: `${base}/hr/salaries`, labelKey: "nav.salaries", icon: <Wallet size={14} />, iconColor: "orange" },
            { href: `${base}/hr/tickets`, labelKey: "nav.tickets", icon: <FileText size={14} />, iconColor: "orange" },
          ],
        },
        { href: `${base}/hr/expiry-alerts`, labelKey: "nav.expiryAlerts", icon: <BarChart3 size={14} />, iconColor: "red" },
      ],
    },
    {
      href: `${base}/accounting`,
      labelKey: "nav.accounting",
      icon: <BookOpen size={16} />,
      iconColor: "emerald",
      module: "ACCOUNTING",
      children: [
        { href: `${base}/accounting/guide`, labelKey: "nav.accountingGuide", icon: <BookOpen size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/receipts`, labelKey: "nav.receipts", icon: <ArrowDownToLine size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/payments`, labelKey: "nav.payments", icon: <ArrowUpFromLine size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/journal-entries`, labelKey: "nav.journalEntries", icon: <FileText size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/end-of-service`, labelKey: "nav.endOfService", icon: <Wallet size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/leave-pay`, labelKey: "nav.leavePay", icon: <Receipt size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/accounts`, labelKey: "nav.accounts", icon: <Receipt size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/bank-accounts`, labelKey: "nav.bankAccounts", icon: <Wallet size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/bank-transfers`, labelKey: "nav.bankTransfers", icon: <ArrowLeftRight size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/fiscal-years`, labelKey: "nav.fiscalYears", icon: <BookOpen size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/trial-balance`, labelKey: "nav.trialBalance", icon: <BarChart3 size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/income-statement`, labelKey: "nav.incomeStatement", icon: <TrendingUp size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/balance-sheet`, labelKey: "nav.balanceSheet", icon: <BarChart3 size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/cash-flow`, labelKey: "nav.cashFlow", icon: <Wallet size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/account-ledger`, labelKey: "nav.accountLedger", icon: <BookOpen size={14} />, iconColor: "emerald" },
        { href: `${base}/accounting/reports/general-ledger`, labelKey: "nav.generalLedger", icon: <FileText size={14} />, iconColor: "emerald" },
      ],
    },
    {
      href: `${base}/delivery`,
      labelKey: "nav.deliveryOperations",
      icon: <Truck size={16} />,
      iconColor: "indigo",
      module: "DELIVERY_OPERATIONS",
      children: [
        { href: `${base}/delivery/contracts`, labelKey: "nav.deliveryContracts", icon: <FileText size={14} />, iconColor: "indigo" },
        { href: `${base}/delivery/drivers`, labelKey: "nav.deliveryDrivers", icon: <Users size={14} />, iconColor: "indigo" },
        { href: `${base}/driver-tracking`, labelKey: "nav.driverTracking", icon: <MapPin size={14} />, iconColor: "indigo", module: "DRIVER_TRACKING" },
        { href: `${base}/driver-accounts`, labelKey: "nav.driverAccounts", icon: <UserRoundPlus size={14} />, iconColor: "indigo", module: "DRIVER_ACCOUNTS" },
        { href: `${base}/delivery/daily-orders`, labelKey: "nav.dailyOrders", icon: <Receipt size={14} />, iconColor: "indigo" },
        { href: `${base}/delivery/invoices`, labelKey: "nav.deliveryInvoices", icon: <Receipt size={14} />, iconColor: "emerald" },
        { href: `${base}/delivery/monthly-reports`, labelKey: "nav.monthlyReports", icon: <FileText size={14} />, iconColor: "indigo" },
        { href: `${base}/delivery/deliveries-report`, labelKey: "nav.deliveriesReport", icon: <FileText size={14} />, iconColor: "emerald" },
        { href: `${base}/delivery/wallet`, labelKey: "nav.driverWallets", icon: <Wallet size={14} />, iconColor: "indigo" },
        { href: `${base}/delivery/deposits`, labelKey: "nav.driverDeposits", icon: <Wallet size={14} />, iconColor: "emerald" },
        { href: `${base}/delivery/payments`, labelKey: "nav.companyPayments", icon: <BarChart3 size={14} />, iconColor: "indigo" },
        { href: `${base}/delivery/vehicle-incidents`, labelKey: "nav.vehicleIncidents", icon: <AlertTriangle size={14} />, iconColor: "amber" },
        { href: `${base}/delivery/violations`, labelKey: "nav.violations", icon: <AlertTriangle size={14} />, iconColor: "red" },
        { href: `${base}/delivery/talabat-imports`, labelKey: "nav.talabatImports", icon: <FileText size={14} />, iconColor: "orange" },
      ],
    },
    {
      href: `${base}/car-wash`,
      labelKey: "nav.carWashOperations",
      icon: <Car size={16} />,
      iconColor: "cyan",
      module: "CAR_WASH_OPERATIONS",
      children: [
        { href: `${base}/car-wash/locations`, labelKey: "nav.carWashLocations", icon: <MapPin size={14} />, iconColor: "cyan" },
        { href: `${base}/car-wash/vehicles`, labelKey: "nav.carWashVehicles", icon: <Car size={14} />, iconColor: "cyan" },
        { href: `${base}/car-wash/operations`, labelKey: "nav.carWashDailyOperations", icon: <Receipt size={14} />, iconColor: "cyan" },
        { href: `${base}/driver-tracking`, labelKey: "nav.driverTracking", icon: <MapPin size={14} />, iconColor: "cyan", module: "DRIVER_TRACKING" },
        { href: `${base}/driver-accounts`, labelKey: "nav.driverAccounts", icon: <UserRoundPlus size={14} />, iconColor: "cyan", module: "DRIVER_ACCOUNTS" },
        { href: `${base}/car-wash/knet`, labelKey: "nav.knet", icon: <Wallet size={14} />, iconColor: "cyan" },
        { href: `${base}/car-wash/profitability`, labelKey: "nav.profitability", icon: <TrendingUp size={14} />, iconColor: "cyan" },
      ],
    },
    {
      href: `${base}/investors`,
      labelKey: "nav.investorsList",
      icon: <Building2 size={16} />,
      iconColor: "teal",
      module: "INVESTORS",
      children: [
        { href: `${base}/investors/branches`, labelKey: "nav.investorBranches", icon: <Building2 size={14} />, iconColor: "teal" },
        { href: `${base}/investors/accounts`, labelKey: "nav.investorAccounts", icon: <Wallet size={14} />, iconColor: "teal" },
        { href: `${base}/investors/claims`, labelKey: "nav.investorClaims", icon: <FileText size={14} />, iconColor: "teal" },
        { href: `${base}/investors/statements`, labelKey: "nav.investorStatements", icon: <FileText size={14} />, iconColor: "teal" },
        { href: `${base}/investors/salaries`, labelKey: "nav.investorSalaries", icon: <Wallet size={14} />, iconColor: "teal" },
        { href: `${base}/managers`, labelKey: "nav.managersBilling", icon: <Wallet size={14} />, iconColor: "emerald" },
      ],
    },
    { href: `${base}/expenses`, labelKey: "nav.expenses", icon: <Receipt size={16} />, iconColor: "red", module: "EXPENSES" },
    { href: `${base}/reports`, labelKey: "nav.reports", icon: <BarChart3 size={16} />, iconColor: "purple", module: "REPORTS" },
    { href: `${base}/attachments`, labelKey: "nav.attachments", icon: <Paperclip size={16} />, iconColor: "sky", module: "ATTACHMENTS" },
    { href: `${base}/assets`, labelKey: "nav.assets", icon: <Package size={16} />, iconColor: "green", module: "ASSETS_CUSTODY" },
    { href: `${base}/import-export`, labelKey: "nav.importExport", icon: <ArrowLeftRight size={16} />, iconColor: "teal" },
    { href: "/dashboard/completed-tasks", labelKey: "nav.completedTasks", icon: <ClipboardCheck size={16} />, iconColor: "green", module: "TASKS" },
  ];
}

function buildOwnerManagedNav(base: string): NavItem[] {
  return [
    { href: `${base}/owner-management`, labelKey: "nav.ownerManagedDashboard", icon: <LayoutDashboard size={16} />, iconColor: "blue" },
    { href: `${base}/owner-management/partners`, labelKey: "nav.ownerManagedPartners", icon: <Users size={16} />, iconColor: "violet" },
    { href: `${base}/owner-management/expenses`, labelKey: "nav.expenses", icon: <Receipt size={16} />, iconColor: "amber" },
    { href: `${base}/owner-management/revenues`, labelKey: "nav.ownerManagedRevenues", icon: <TrendingUp size={16} />, iconColor: "emerald" },
    { href: `${base}/owner-management/import`, labelKey: "nav.ownerManagedImport", icon: <ArrowUpFromLine size={16} />, iconColor: "cyan" },
    { href: `${base}/owner-management/imports`, labelKey: "nav.ownerManagedImports", icon: <BookOpen size={16} />, iconColor: "teal" },
    { href: "/dashboard", labelKey: "nav.groupDashboard", icon: <Building2 size={16} />, iconColor: "slate" },
  ];
}

function filterGroupNav(user: SessionUser, items: NavItem[]) {
  return items.filter((item) => {
    if (item.href === "/dashboard") return true;
    if (item.module === "USERS") return user.isSuperAdmin || hasPermission(user, "USERS", "VIEW");
    if (item.module === "SETTINGS") return true;
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
  }).map((item) => item.children
    ? {
        ...item,
        children: item.children.filter((child) => !child.module || hasPermission(user, child.module, "VIEW", { companyId: company.id })),
      }
    : item);
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
  const { isOpen, close } = useSidebar();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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
    if (!mounted || !currentCompany) return filterGroupNav(session, GROUP_NAV);
    if (currentCompany.type === "OWNER_MANAGED") return buildOwnerManagedNav(`/dashboard/companies/${currentCompany.id}`);
    return filterCompanyNav(session, currentCompany, buildCompanyNav(`/dashboard/companies/${currentCompany.id}`));
  }, [mounted, currentCompany, session]);

  // Per-company/group persistence key.
  const storageKey = `sidebar-exp:${resolvedCompanyId ?? "group"}`;

  // Restore expanded sections, or open the active section on first load.
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setExpandedItems(JSON.parse(saved) as string[]);
        return;
      }
    } catch {
      // ignore
    }

    setExpandedItems(
      navItems
        .filter((item) => item.children?.length && pathname.startsWith(item.href + "/"))
        .map((item) => item.href),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, navItems, storageKey]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function toggleExpand(href: string) {
    setExpandedItems((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const companySubtitle = mounted && currentCompany
    ? locale === "en"
      ? currentCompany.nameEn ?? currentCompany.nameAr
      : currentCompany.nameAr
    : locale === "en"
      ? "Access is filtered by company and group"
      : "\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u0634ر\u0643\u0629 \u0648\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629";

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />
      <aside className={`app-sidebar fixed top-0 z-40 flex h-full w-64 flex-col bg-sidebar shadow-xl ${isOpen ? "sidebar-open" : ""}`}>
        <div className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={close}
              className="md:hidden shrink-0 rounded-lg p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <span className="text-lg font-bold text-white">ر</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-sidebar-foreground">{t("system.name")}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{companySubtitle}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navItems
            .filter((item) => !item.adminOnly || session.isSuperAdmin)
            .map((item) => (
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
          {userName && <p className="px-3 pb-1 text-xs text-sidebar-foreground/60">{userName}</p>}
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
            <IconBadge color="red" size="sm">
              <LogOut size={14} />
            </IconBadge>
            <span>{t("system.logout")}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Colored icon badge
function IconBadge({
  color,
  children,
  size = "md",
}: {
  color?: string;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  const key = (color ?? "slate") as ColorKey;
  const scheme = C[key] ?? C.slate;
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";

  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md", dim, scheme.bg, scheme.text)}>
      {children}
    </span>
  );
}

// Nav item component
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
  const colorKey = (item.iconColor ?? "slate") as ColorKey;
  const scheme = C[colorKey] ?? C.slate;
  const [childExpanded, setChildExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!item.children) return;

    const toExpand = item.children
      .filter((child) => child.children?.length && (pathname === child.href || pathname.startsWith(child.href + "/")))
      .map((child) => child.href);

    if (toExpand.length) {
      setChildExpanded((prev) => [...new Set([...prev, ...toExpand])]);
    }
  }, [pathname, item.children]);

  function toggleChild(href: string) {
    setChildExpanded((prev) => (
      prev.includes(href) ? prev.filter((itemHref) => itemHref !== href) : [...prev, href]
    ));
  }

  if (hasChildren) {
    return (
      <div className="mb-0.5">
        <div
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
            isActive
              ? cn("border-r-2 font-medium text-sidebar-foreground", scheme.active)
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconBadge color={item.iconColor}>{item.icon}</IconBadge>
            <span className="flex-1 truncate text-right">{t(item.labelKey)}</span>
          </Link>
          <button onClick={onToggle} className="shrink-0 rounded p-0.5 hover:bg-sidebar-accent">
            {isExpanded ? <ChevronDown size={13} className="opacity-60" /> : <ChevronLeft size={13} className="opacity-60" />}
          </button>
        </div>

        {isExpanded && (
          <div className="mb-1 mr-3 mt-0.5 space-y-0.5 border-r-2 pr-2" style={{ borderColor: "var(--sidebar-border)" }}>
            {item.children!.map((child) => (
              <NavItemComponent
                key={child.href}
                item={child}
                pathname={pathname}
                isExpanded={childExpanded.includes(child.href)}
                onToggle={() => toggleChild(child.href)}
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
        "mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        isActive
          ? cn("border-r-2 font-medium text-sidebar-foreground", scheme.active)
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <IconBadge color={item.iconColor} size="sm">
        {item.icon}
      </IconBadge>
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}
