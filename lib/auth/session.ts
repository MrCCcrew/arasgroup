import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { JwtPayload, SessionUser } from "@/lib/types";
import { getLocale } from "@/lib/i18n";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production-32ch",
);
const COOKIE_NAME = "rashid_erp_session";
const EXPIRES_IN = 7 * 24 * 60 * 60;

export async function createSession(user: SessionUser): Promise<string> {
  const locale = user.locale ?? await getLocale();
  const isSuperAdmin = user.isSuperAdmin;

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    locale,
    isSuperAdmin,
    roles: user.roles,
    groupAccess: isSuperAdmin ? [] : user.groupAccess,
    companyAccess: user.companyAccess,
    companyAccessEntries: isSuperAdmin ? [] : user.companyAccessEntries,
    branchAccess: isSuperAdmin ? [] : user.branchAccess,
    permissions: isSuperAdmin ? [] : user.permissions,
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

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email,
    nameAr: payload.nameAr,
    nameEn: payload.nameEn,
    locale: payload.locale,
    isSuperAdmin: payload.isSuperAdmin,
    roles: payload.roles,
    groupAccess: payload.groupAccess ?? [],
    companyAccess: payload.companyAccess ?? (payload.companyAccessEntries ?? []).map((entry) => entry.companyId),
    companyAccessEntries: payload.companyAccessEntries ?? [],
    branchAccess: payload.branchAccess ?? [],
    permissions: payload.permissions ?? [],
  };
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
