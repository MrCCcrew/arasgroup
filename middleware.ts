import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "rashid_erp_session";
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
    return NextResponse.redirect(new URL("/login", request.url));
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

    // Redirect drivers to /driver portal
    if (accountType === 'DRIVER' || accountType === 'CAR_WASH_WORKER') {
      if (!pathname.startsWith('/driver') && !pathname.startsWith('/api/driver')) {
        return NextResponse.redirect(new URL('/driver', request.url));
      }
    } else {
      // Redirect admin users away from driver portal
      if (pathname.startsWith('/driver')) {
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
