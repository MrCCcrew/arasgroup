"use client";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale } from "@/components/providers/locale-provider";

export function DriverPortalHeader() {
  const { t } = useLocale();
  return <header className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold text-gray-700">{t("driver.portal")}</span><LanguageSwitcher /></header>;
}
