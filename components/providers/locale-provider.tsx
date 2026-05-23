"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { defaultLocale, type Locale } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/runtime";

interface LocaleContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (path: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<void>;
  isPending: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isPending, startTransition] = useTransition();

  async function setLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;

    startTransition(() => {
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
    });

    await fetch("/api/preferences/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });
  }

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: (path, params) => translate(locale, path, params),
    setLocale,
    isPending,
  }), [isPending, locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext) ?? {
    locale: defaultLocale,
    dir: "rtl" as const,
    t: (path: string) => path,
    setLocale: async () => undefined,
    isPending: false,
  };
}
