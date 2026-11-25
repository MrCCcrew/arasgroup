import { cookies } from "next/headers";
import { DEFAULT_UI_STYLE, isUiStyle, UI_STYLE_COOKIE_NAME, type UiStyle } from "./ui-style-shared";

export { DEFAULT_UI_STYLE, UI_STYLE_COOKIE_NAME, isUiStyle, type UiStyle } from "./ui-style-shared";

export async function getUiStyle(): Promise<UiStyle> {
  const cookieStore = await cookies();
  const candidate = cookieStore.get(UI_STYLE_COOKIE_NAME)?.value;
  return isUiStyle(candidate) ? candidate : DEFAULT_UI_STYLE;
}
