"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {actions}

          {mounted && pendingCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-700">
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>{t("header.unsyncedTransactions", { count: pendingCount })}</span>
            </div>
          )}

          {mounted && <LanguageSwitcher />}

          {mounted && companyId && (
            <Link
              href="/dashboard"
              className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("system.switchCompany")}
            </Link>
          )}

          {mounted && <NotificationBell />}
        </div>
      </div>
    </header>
  );
}
