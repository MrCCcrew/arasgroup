"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageSwitcher() {
  const { locale, setLocale, t, isPending } = useLocale();

  async function toggleLanguage() {
    const nextLocale: Locale = locale === "ar" ? "en" : "ar";
    await setLocale(nextLocale);
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      aria-label={t("locale.switcherLabel")}
    >
      <Languages size={14} />
      <span>{locale === "ar" ? t("locale.english") : t("locale.arabic")}</span>
    </button>
  );
}
