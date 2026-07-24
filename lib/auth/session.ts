import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { JwtPayload, SessionUser } from "@/lib/types";
import { getLocale } from "@/lib/i18n";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production-32ch",
);
const COOKIE_NAME = "rashid_erp_session";
const EXPIRES_IN = 7 * 24 * 60 * 60;

// ── كاش الجلسة في الذاكرة — يمنع query ثقيل عند كل request ─────
// TTL 30 ثانية: يضمن تحديث سريع للصلاحيات بعد التعديل
const SESSION_CACHE_TTL = 30 * 1000; // 30 seconds in ms
const sessionCache = new Map<string, { data: SessionUser; expiresAt: number }>();

function getCached(userId: string, locale?: string): SessionUser | null {
  const key = `${userId}:${locale ?? "ar"}`;
  const entry = sessionCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    sessionCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(userId: string, locale: string | undefined, data: SessionUser) {
  sessionCache.set(`${userId}:${locale ?? "ar"}`, {
    data,
    expiresAt: Date.now() + SESSION_CACHE_TTL,
  });
}

export function invalidateSessionCache(userId: string) {
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${userId}:`)) sessionCache.delete(key);
  }
}

export async function createSession(user: SessionUser): Promise<string> {
  const locale = user.locale ?? await getLocale();

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    locale,
    isSuperAdmin: user.isSuperAdmin,
    employeeId: user.employeeId,
    accountType: user.accountType,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET);

  return token;
}

export async function verifySession(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

async function loadSessionUser(userId: string, locale?: "ar" | "en"): Promise<SessionUser | null> {
  // ── تحقق من الكاش أولاً ───────────────────────────────────────
  const cached = getCached(userId, locale);
  if (cached) return cached;

  let user: any = null;

  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        groupAccess: true,
        companyAccess: true,
        branchAccess: true,
        directPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Session query fallback:", error);
    user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        groupAccess: true,
        companyAccess: true,
        branchAccess: true,
      },
    });
  }

  if (!user || !user.isActive) {
    return null;
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    locale,
    isSuperAdmin: user.isSuperAdmin,
    employeeId: user.employeeId,
    accountType: user.accountType,
    roles: user.roles.map((ur: any) => ({
      name: ur.role.name,
      companyId: ur.companyId,
    })),
    groupAccess: user.groupAccess.map((entry: any) => ({
      groupId: entry.groupId,
      canView: entry.canView,
      canCreate: entry.canCreate,
      canUpdate: entry.canUpdate,
      canDelete: entry.canDelete,
      canApprove: entry.canApprove,
    })),
    companyAccess: user.companyAccess.map((entry: any) => entry.companyId),
    companyAccessEntries: user.companyAccess.map((entry: any) => ({
      companyId: entry.companyId,
      roleId: entry.roleId,
      canView: entry.canView,
      canCreate: entry.canCreate,
      canUpdate: entry.canUpdate,
      canDelete: entry.canDelete,
      canApprove: entry.canApprove,
    })),
    branchAccess: user.branchAccess.map((entry: any) => ({
      branchId: entry.branchId,
      companyId: entry.companyId,
      canView: entry.canView,
      canCreate: entry.canCreate,
      canUpdate: entry.canUpdate,
      canDelete: entry.canDelete,
      canApprove: entry.canApprove,
    })),
    permissions: user.roles
      .flatMap((ur: any) =>
        ur.role.permissions.map((permissionLink: any) => ({
          permissionId: permissionLink.permission.id,
          module: permissionLink.permission.module,
          action: permissionLink.permission.action,
          scope: permissionLink.permission.scope,
          companyId: ur.companyId,
          allowed: true,
        })),
      )
      .concat(
        (user.directPermissions ?? []).map((entry: any) => ({
          permissionId: entry.permissionId,
          module: entry.permission.module,
          action: entry.permission.action,
          scope: entry.permission.scope,
          companyId: entry.companyId,
          branchId: entry.branchId,
          scopeKey: entry.scopeKey,
          allowed: entry.isAllowed,
        })),
      ),
  };

  setCache(userId, locale, sessionUser);
  return sessionUser;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  return loadSessionUser(payload.sub, payload.locale);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}
