import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/types";
import { z } from "zod";

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
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
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

    if (!user) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "الحساب غير مفعّل. يرجى التواصل مع المسؤول" },
        { status: 401 }
      );
    }

    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      nameAr: user.nameAr,
      nameEn: user.nameEn,
      isSuperAdmin: user.isSuperAdmin,
      roles: user.roles.map((ur) => ({
        name: ur.role.name,
        companyId: ur.companyId,
      })),
      groupAccess: user.groupAccess.map((entry) => ({
        groupId: entry.groupId,
        canView: entry.canView,
        canCreate: entry.canCreate,
        canUpdate: entry.canUpdate,
        canDelete: entry.canDelete,
        canApprove: entry.canApprove,
      })),
      companyAccess: user.companyAccess.map((ca) => ca.companyId),
      companyAccessEntries: user.companyAccess.map((ca) => ({
        companyId: ca.companyId,
        roleId: ca.roleId,
        canView: ca.canView,
        canCreate: ca.canCreate,
        canUpdate: ca.canUpdate,
        canDelete: ca.canDelete,
        canApprove: ca.canApprove,
      })),
      branchAccess: user.branchAccess.map((ba) => ({
        branchId: ba.branchId,
        companyId: ba.companyId,
        canView: ba.canView,
        canCreate: ba.canCreate,
        canUpdate: ba.canUpdate,
        canDelete: ba.canDelete,
        canApprove: ba.canApprove,
      })),
      permissions: user.roles.flatMap((ur) =>
        ur.role.permissions.map((permissionLink) => ({
          permissionId: permissionLink.permission.id,
          module: permissionLink.permission.module,
          action: permissionLink.permission.action,
          scope: permissionLink.permission.scope,
          companyId: ur.companyId,
          allowed: true,
        }))
      ).concat(
        user.directPermissions.map((entry) => ({
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

    // Audit log
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

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        nameAr: user.nameAr,
        nameEn: user.nameEn,
        isSuperAdmin: user.isSuperAdmin,
        roles: sessionUser.roles,
        companyAccess: sessionUser.companyAccess,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: EXPIRES_IN,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
