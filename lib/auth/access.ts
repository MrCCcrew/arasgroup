import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession, getTokenFromRequest, verifySession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";
import { canAccessBranch, canAccessCompany, hasPermission, type Action, type Module } from "@/lib/auth/permissions";

export function isOwnerOrAdminSession(session: SessionUser): boolean {
  return session.isSuperAdmin || session.roles.some((role) => role.name === "GROUP_OWNER");
}

export function getRequestSession(request: NextRequest): SessionUser | null {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  if (!userId || !email) return null;

  return {
    id: userId,
    email,
    nameAr: request.headers.get("x-user-name-ar") ?? "",
    nameEn: request.headers.get("x-user-name-en"),
    isSuperAdmin: request.headers.get("x-user-superadmin") === "true",
    roles: JSON.parse(request.headers.get("x-user-roles") ?? "[]"),
    groupAccess: JSON.parse(request.headers.get("x-user-groups") ?? "[]"),
    companyAccess: JSON.parse(request.headers.get("x-user-companies") ?? "[]"),
    companyAccessEntries: JSON.parse(request.headers.get("x-user-company-access") ?? "[]"),
    branchAccess: JSON.parse(request.headers.get("x-user-branches") ?? "[]"),
    permissions: JSON.parse(request.headers.get("x-user-permissions") ?? "[]"),
  };
}

export async function requireRequestSession(request: NextRequest): Promise<SessionUser | NextResponse> {
  const headerSession = getRequestSession(request);
  if (headerSession) return headerSession;

  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
  }

  const payload = await verifySession(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "انتهت صلاحية الجلسة" }, { status: 401 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "انتهت صلاحية الجلسة" }, { status: 401 });
  }

  return session;
}

export function assertCompanyAccess(session: SessionUser, companyId: string): NextResponse | null {
  if (canAccessCompany(session, companyId)) return null;
  return NextResponse.json({ success: false, error: "لا تملك صلاحية الوصول إلى هذه الشركة" }, { status: 403 });
}

export function assertBranchAccess(session: SessionUser, branchId: string): NextResponse | null {
  if (canAccessBranch(session, branchId)) return null;
  return NextResponse.json({ success: false, error: "لا تملك صلاحية الوصول إلى هذا الفرع" }, { status: 403 });
}

export function assertPermission(
  session: SessionUser,
  module: Module,
  action: Action,
  options?: { companyId?: string; branchId?: string },
): NextResponse | null {
  if (hasPermission(session, module, action, options)) return null;
  return NextResponse.json({ success: false, error: "لا تملك الصلاحية المطلوبة" }, { status: 403 });
}
