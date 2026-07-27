import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n";

const COOKIE_NAME = "rashid_erp_session";
const EXPIRES_IN = 7 * 24 * 60 * 60;

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email, password } = parsed.data;

    let user: any = null;

    try {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
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
      console.error("Login query fallback:", error);
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
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

    if (!user) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "الحساب غير مفعل. يرجى التواصل مع المسؤول" },
        { status: 401 },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: "هذا الحساب لا يحتوي على كلمة مرور صالحة بعد" },
        { status: 400 },
      );
    }

    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      nameAr: user.nameAr,
      nameEn: user.nameEn,
      isSuperAdmin: user.isSuperAdmin,
      employeeId: user.employeeId || null,
      accountType: user.accountType || "ADMIN",
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
      companyAccess: user.companyAccess.map((ca: any) => ca.companyId),
      companyAccessEntries: user.companyAccess.map((ca: any) => ({
        companyId: ca.companyId,
        roleId: ca.roleId,
        canView: ca.canView,
        canCreate: ca.canCreate,
        canUpdate: ca.canUpdate,
        canDelete: ca.canDelete,
        canApprove: ca.canApprove,
      })),
      branchAccess: user.branchAccess.map((ba: any) => ({
        branchId: ba.branchId,
        companyId: ba.companyId,
        canView: ba.canView,
        canCreate: ba.canCreate,
        canUpdate: ba.canUpdate,
        canDelete: ba.canDelete,
        canApprove: ba.canApprove,
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

    const token = await createSession(sessionUser);

    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          module: "auth",
          resourceId: user.id,
          resourceType: "User",
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        },
      });
    } catch (error) {
      console.error("Login audit log error:", error);
    }

    // Return user data (compatible with both web and desktop app)
    const userData = {
      id: user.id,
      email: user.email,
      nameAr: user.nameAr,
      nameEn: user.nameEn,
      isSuperAdmin: user.isSuperAdmin,
      accountType: sessionUser.accountType,
      roles: sessionUser.roles,
      companyAccess: sessionUser.companyAccess,
    };

    const response = NextResponse.json({
      success: true,
      data: userData,
      user: userData, // For desktop app compatibility
      redirectTo: sessionUser.accountType === "OWNER_MANAGED_PARTNER"
        ? "/partner"
        : sessionUser.accountType === "DRIVER" || sessionUser.accountType === "CAR_WASH_WORKER"
          ? "/driver"
          : "/dashboard",
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: EXPIRES_IN,
      path: "/",
    });

    if ((sessionUser.accountType === "DRIVER" || sessionUser.accountType === "CAR_WASH_WORKER") && !request.cookies.get(LOCALE_COOKIE_NAME)) {
      response.cookies.set(LOCALE_COOKIE_NAME, "en", {
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, error: "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}
