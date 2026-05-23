"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface NotificationListItem {
  id: string;
  titleAr: string;
  titleEn?: string | null;
  messageAr?: string | null;
  messageEn?: string | null;
  severity: string;
  status: string;
  dueDate?: string | null;
}

export function NotificationBell() {
  const { locale, t } = useLocale();
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function loadNotifications() {
    const response = await fetch("/api/notifications?limit=5&status=UNREAD", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const nextItems = payload.data?.items ?? [];
    setItems(nextItems);
    setUnreadCount(payload.data?.unreadCount ?? 0);
  }

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 45000);
    return () => window.clearInterval(interval);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    await loadNotifications();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-full p-2 transition-colors hover:bg-muted"
        aria-label={t("header.notifications")}
      >
        <Bell size={18} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 left-0 z-50 w-96 max-w-[calc(100vw-1rem)] rounded-xl border bg-background p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{t("header.notifications")}</p>
              <p className="text-xs text-muted-foreground">{t("header.unread")}</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck size={12} />
              {t("header.markAllRead")}
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="rounded-lg bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                {t("notification.empty")}
              </p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href="/dashboard/notifications"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg border px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <p className="font-medium">{locale === "en" ? item.titleEn ?? item.titleAr : item.titleAr}</p>
                  {(locale === "en" ? item.messageEn ?? item.messageAr : item.messageAr) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {locale === "en" ? item.messageEn ?? item.messageAr : item.messageAr}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>

          <div className="mt-3 border-t pt-3 text-center">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
              {t("header.viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
