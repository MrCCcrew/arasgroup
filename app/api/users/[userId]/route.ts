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

  // ── تحقق من السجلات المرتبطة بالمستخدم ────────────────────────
  const relatedRecords = await prisma.$transaction(async (tx) => {
    const [
      journalEntries,
      attachments,
      auditLogs,
      driverAssignments,
      assetCustodies,
      talabatImports,
      talabatAllocations,
      activityLogs,
    ] = await Promise.all([
      tx.journalEntry.count({ where: { createdById: userId } }),
      tx.attachment.count({ where: { uploadedById: userId } }),
      tx.auditLog.count({ where: { userId } }),
      tx.driverVehicleAssignment.count({ where: { createdById: userId } }),
      tx.assetCustody.count({
        where: {
          OR: [
            { assignedById: userId },
            { returnedToId: userId }
          ]
        }
      }),
      tx.talabatReportImport.count({ where: { createdById: userId } }),
      tx.talabatReportAllocation.count({ where: { createdById: userId } }),
      tx.employeeActivityLog.count({ where: { userId } }),
    ]);

    return {
      journalEntries,
      attachments,
      auditLogs,
      driverAssignments,
      assetCustodies,
      talabatImports,
      talabatAllocations,
      activityLogs,
    };
  });

  // حساب إجمالي السجلات
  const totalRecords = Object.values(relatedRecords).reduce((sum, count) => sum + count, 0);

  // إذا كان هناك سجلات، أرجع قائمة بها
  if (totalRecords > 0) {
    const recordsList = [];
    if (relatedRecords.journalEntries > 0) {
      recordsList.push({ type: "journalEntries", nameAr: "قيود يومية", count: relatedRecords.journalEntries });
    }
    if (relatedRecords.attachments > 0) {
      recordsList.push({ type: "attachments", nameAr: "مرفقات", count: relatedRecords.attachments });
    }
    if (relatedRecords.auditLogs > 0) {
      recordsList.push({ type: "auditLogs", nameAr: "سجلات التدقيق", count: relatedRecords.auditLogs });
    }
    if (relatedRecords.driverAssignments > 0) {
      recordsList.push({ type: "driverAssignments", nameAr: "تعيينات سائقين", count: relatedRecords.driverAssignments });
    }
    if (relatedRecords.assetCustodies > 0) {
      recordsList.push({ type: "assetCustodies", nameAr: "عهدة أصول", count: relatedRecords.assetCustodies });
    }
    if (relatedRecords.talabatImports > 0) {
      recordsList.push({ type: "talabatImports", nameAr: "تقارير طلبات", count: relatedRecords.talabatImports });
    }
    if (relatedRecords.talabatAllocations > 0) {
      recordsList.push({ type: "talabatAllocations", nameAr: "توزيعات طلبات", count: relatedRecords.talabatAllocations });
    }
    if (relatedRecords.activityLogs > 0) {
      recordsList.push({ type: "activityLogs", nameAr: "سجلات النشاط", count: relatedRecords.activityLogs });
    }

    return NextResponse.json({
      success: false,
      hasRelatedRecords: true,
      totalRecords,
      records: recordsList,
      message: "لا يمكن حذف المستخدم لوجود سجلات مرتبطة به",
    }, { status: 400 });
  }

  // إذا لم يكن هناك سجلات، احذف المستخدم
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
