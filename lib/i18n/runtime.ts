import { defaultLocale, localeLabels, messages, type Locale, type MessageTree } from "./messages";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "ar" || value === "en";
}

export function getLocaleDirection(locale: Locale): "rtl" | "ltr" {
  return localeLabels[locale].dir;
}

export function getLocaleLabel(locale: Locale) {
  return localeLabels[locale];
}

function resolveMessage(tree: MessageTree, path: string): MessageTree[keyof MessageTree] | undefined {
  return path.split(".").reduce<MessageTree[keyof MessageTree] | undefined>((current, part) => {
    if (!current || typeof current === "string" || typeof current === "function") return undefined;
    return current[part];
  }, tree);
}

export function translate(
  locale: Locale,
  path: string,
  params?: Record<string, string | number>,
): string {
  const value = resolveMessage(messages[locale], path) ?? resolveMessage(messages[defaultLocale], path);
  if (typeof value === "function") {
    return value(params);
  }
  if (typeof value === "string") {
    return value;
  }
  return path;
}

export function pickLocalized<T extends { nameAr?: string | null; nameEn?: string | null; titleAr?: string | null; titleEn?: string | null }>(
  locale: Locale,
  value: T,
  fallback = "",
): string {
  if (locale === "en") return value.nameEn ?? value.titleEn ?? value.nameAr ?? value.titleAr ?? fallback;
  return value.nameAr ?? value.titleAr ?? value.nameEn ?? value.titleEn ?? fallback;
}
