export type UiStyle = "classic" | "modern";

export const UI_STYLE_COOKIE_NAME = "aras_ui_style";

/** Change to "modern" to make the new interface the default for everyone. */
export const DEFAULT_UI_STYLE: UiStyle = "classic";

export function isUiStyle(value: unknown): value is UiStyle {
  return value === "classic" || value === "modern";
}

/**
 * Persists the choice in a cookie from the browser.
 * No API route on purpose: middleware blocks portal accounts
 * (DRIVER, CAR_WASH_WORKER, GROCERY_EMPLOYEE, OWNER_MANAGED_PARTNER) from other /api paths.
 */
export function writeUiStyleCookie(style: UiStyle) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${UI_STYLE_COOKIE_NAME}=${style}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}
