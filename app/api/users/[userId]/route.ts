import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
    if (isActive === null) {
      return NextResponse.json({ success: false, error: "حالة المستخدم غير صالحة" }, { status: 400 });
    }

    if (session.id === userId && isActive === false) {
      return NextResponse.json({ success: false, error: "لا يمكن تعطيل الحساب الحالي" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, isSuperAdmin: true, nameAr: true },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (existingUser.isSuperAdmin && isActive === false) {
      const activeSuperAdmins = await prisma.user.count({
        where: { isSuperAdmin: true, isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        return NextResponse.json({ success: false, error: "لا يمكن تعطيل آخر مدير نظام" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: { id: true, isActive: true, nameAr: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: isActive ? "ACTIVATE_USER" : "DISABLE_USER",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          oldValues: { isActive: existingUser.isActive },
          newValues: { isActive: user.isActive, nameAr: existingUser.nameAr },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return user;
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث المستخدم";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await params;

  if (session.id === userId) {
    return NextResponse.json({ success: false, error: "لا يمكن حذف الحساب الحالي" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSuperAdmin: true, nameAr: true, isActive: true },
  });

  if (!existingUser) {
    return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
  }

  if (existingUser.isSuperAdmin) {
    const superAdminsCount = await prisma.user.count({
      where: { isSuperAdmin: true },
    });
    if (superAdminsCount <= 1) {
      return NextResponse.json({ success: false, error: "لا يمكن حذف آخر مدير نظام" }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: userId } });
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "DELETE_USER",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          oldValues: {
            nameAr: existingUser.nameAr,
            isSuperAdmin: existingUser.isSuperAdmin,
            isActive: existingUser.isActive,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حذف المستخدم";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
