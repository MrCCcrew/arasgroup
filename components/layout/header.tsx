"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useSyncStatus } from "@/lib/offline/sync-status";
import { useLocale } from "@/components/providers/locale-provider";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  companyId?: string;
}

export function Header({ title, subtitle, actions, companyId }: HeaderProps) {
  const { pendingCount, isSyncing } = useSyncStatus();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const { toggle } = useSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      {/* Main row */}
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="القائمة"
        >
          <Menu size={20} />
        </button>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight text-foreground md:text-lg">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
          )}
        </div>

        {/* Desktop inline actions */}
        {actions && (
          <div className="hidden items-center gap-2 md:flex">{actions}</div>
        )}

        {/* Right-side nav items */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
          {mounted && pendingCount > 0 && (
            <div className="hidden items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-700 md:flex">
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>{t("header.unsyncedTransactions", { count: pendingCount })}</span>
            </div>
          )}
          <span className="hidden md:block">
            {mounted && <LanguageSwitcher />}
          </span>
          {mounted && companyId && (
            <Link
              href="/dashboard"
              className="hidden rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              {t("system.switchCompany")}
            </Link>
          )}
          {mounted && <NotificationBell />}
        </div>
      </div>

      {/* Mobile actions row */}
      {actions && (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border/50 px-4 pb-2 pt-2 md:hidden">
          {actions}
        </div>
      )}
    </header>
  );
}
