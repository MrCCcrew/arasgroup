import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "rashid_erp_session";
const LOCALE_COOKIE_NAME = "rashid_erp_locale";
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/push/dispatch",
  "/api/activity-logs", // Desktop app sends activity logs
];

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production-32ch",
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname === "/driver" || pathname.startsWith("/driver/")) {
      loginUrl.searchParams.set("portal", "driver");
    } else if (pathname === "/car-wash-portal" || pathname.startsWith("/car-wash-portal/")) {
      loginUrl.searchParams.set("portal", "car-wash");
    }
    const response = NextResponse.redirect(loginUrl);
    if ((loginUrl.searchParams.get("portal") === "driver" || loginUrl.searchParams.get("portal") === "car-wash") && !request.cookies.get(LOCALE_COOKIE_NAME)) {
      response.cookies.set(LOCALE_COOKIE_NAME, "en", { sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60 });
    }
    return response;
  }

  // Decode JWT to check account type
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const accountType = payload.accountType as string | undefined;

    if (accountType === "OWNER_MANAGED_PARTNER") {
      if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
        return NextResponse.redirect(new URL("/partner", request.url));
      }
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/owner-management/partner/")) {
        return NextResponse.json({ success: false, error: "غير مصرح بالوصول إلى واجهات الإدارة" }, { status: 403 });
      }
    } else if (pathname === "/partner" || pathname.startsWith("/partner/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (accountType === 'DRIVER') {
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/driver/')) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
      }
      if (!pathname.startsWith('/driver') && !pathname.startsWith('/api/driver')) {
        return NextResponse.redirect(new URL('/driver', request.url));
      }
    } else if (accountType === 'CAR_WASH_WORKER') {
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/car-wash-portal/')) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
      }
      if (!pathname.startsWith('/car-wash-portal') && !pathname.startsWith('/api/car-wash-portal/')) {
        return NextResponse.redirect(new URL('/car-wash-portal', request.url));
      }
    } else {
      // Redirect admin users away from driver portal
      if (pathname.startsWith('/driver') || pathname.startsWith('/car-wash-portal')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  } catch (error) {
    console.error('JWT verification failed in middleware:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
