import { cookies } from "next/headers";
import { defaultLocale, type Locale } from "./messages";
export { isLocale, getLocaleDirection, getLocaleLabel, translate, pickLocalized } from "./runtime";

export const LOCALE_COOKIE_NAME = "rashid_erp_locale";
import { isLocale } from "./runtime";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const candidate = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(candidate) ? candidate : defaultLocale;
}
