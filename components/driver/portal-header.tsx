"use client";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UiStyleSwitcher } from "@/components/layout/ui-style-switcher";
import { useLocale } from "@/components/providers/locale-provider";

export function DriverPortalHeader() {
  const { t } = useLocale();
  return <header className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold text-gray-700">{t("driver.portal")}</span><span className="flex items-center gap-2"><UiStyleSwitcher showLabel={false} /><LanguageSwitcher /></span></header>;
}
