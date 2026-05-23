import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE_NAME } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!isLocale(body?.locale)) {
    return NextResponse.json({ success: false, error: "Invalid locale" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, body.locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  return NextResponse.json({ success: true });
}
