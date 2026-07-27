"use client";

import Link from "next/link";
import { History, Home, LogOut, ReceiptText, WalletCards } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale } from "@/components/providers/locale-provider";

type Props = {
  userNameAr: string | null | undefined;
  userNameEn: string | null | undefined;
  userEmail: string;
  companyNameAr: string | null | undefined;
  companyNameEn: string | null | undefined;
};

export function CarWashPortalNavigation({ userNameAr, userNameEn, userEmail, companyNameAr, companyNameEn }: Props) {
  const { locale } = useLocale();
  const english = locale === "en";
  const t = (ar: string, en: string) => (english ? en : ar);
  const userName = (english ? userNameEn : userNameAr) ?? userNameEn ?? userNameAr ?? userEmail;
  const companyName = (english ? companyNameEn : companyNameAr) ?? companyNameEn ?? companyNameAr ?? "";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    } finally {
      // replace removes this protected page from the immediate browser history.
      window.location.replace("/login?portal=car-wash");
    }
  }

  const links = [
    { href: "/car-wash-portal", icon: Home, label: t("\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", "Home") },
    { href: "/car-wash-portal/expenses", icon: ReceiptText, label: t("\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A", "Expenses") },
    { href: "/car-wash-portal/revenues", icon: WalletCards, label: t("\u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A", "Revenues") },
    { href: "/car-wash-portal/history", icon: History, label: t("\u0627\u0644\u0633\u062C\u0644", "History") },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b bg-white/95 shadow-sm backdrop-blur" dir={english ? "ltr" : "rtl"}>
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link href="/car-wash-portal" className="min-w-0" aria-label={t("\u0627\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0644\u0644\u0628\u0648\u0627\u0628\u0629", "Portal home")}>
            <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{companyName}</p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <button type="button" onClick={logout} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700" aria-label={t("\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", "Log out")}>
              <LogOut size={15} /> {t("\u062E\u0631\u0648\u062C", "Logout")}
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-2px_10px_rgba(15,23,42,0.08)] backdrop-blur" dir={english ? "ltr" : "rtl"} aria-label={t("\u062A\u0646\u0642\u0644 \u0627\u0644\u0628\u0648\u0627\u0628\u0629", "Portal navigation")}>
        <div className="mx-auto grid max-w-lg grid-cols-6 px-1 py-1">
          {links.map(({ href, icon: Icon, label }) => <Link key={href} href={href} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-slate-600 hover:bg-slate-100"><Icon size={18} />{label}</Link>)}
          <div className="flex min-h-14 items-center justify-center"><LanguageSwitcher /></div>
          <button type="button" onClick={logout} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-red-700 hover:bg-red-50"><LogOut size={18} />{t("\u062E\u0631\u0648\u062C", "Logout")}</button>
        </div>
      </nav>
    </>
  );
}
