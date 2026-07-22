import { getSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { validateBackupFilename, resolveBackupPath } from "@/lib/backup/server-backups";
import { prisma } from "@/lib/db";

const REQUIRED_CONFIRMATION = "RESTORE RASHIDGROUP";

export async function POST(request: NextRequest) {
  try {
    // 1. التحقق من المصادقة
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. التحقق من الصلاحيات
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin only" },
        { status: 403 }
      );
    }

    // 3. قراءة البيانات
    const body = await request.json();
    const { backupFilename, confirmationPhrase } = body;

    // 4. التحقق من البيانات المطلوبة
    if (!backupFilename || typeof backupFilename !== "string") {
      return NextResponse.json(
        { error: "Backup filename is required" },
        { status: 400 }
      );
    }

    // 5. التحقق من عبارة التأكيد المطابقة تماماً
    if (confirmationPhrase !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        {
          error: `Confirmation phrase must be exactly: ${REQUIRED_CONFIRMATION}`,
        },
        { status: 400 }
      );
    }

    // 6. التحقق من صحة اسم الملف
    if (!validateBackupFilename(backupFilename)) {
      return NextResponse.json(
        { error: "Invalid backup filename format" },
        { status: 400 }
      );
    }

    // 7. التحقق من وجود الملف (بدون فتحه)
    try {
      resolveBackupPath(backupFilename);
    } catch (error) {
      return NextResponse.json(
        { error: "Backup file not found or invalid" },
        { status: 404 }
      );
    }

    // 8. تسجيل الطلب في AuditLog فقط (لا تنفيذ!)
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "BACKUP_RESTORE_REQUESTED",
        module: "BACKUP",
        resourceId: backupFilename,
        resourceType: "BackupFile",
        newValues: {
          backupFilename,
          confirmationPhrase,
          status: "pending_manual_restore",
          requestedAt: new Date().toISOString(),
          requestedBy: session.id,
          requestedByEmail: session.email,
          requestedByName: session.nameAr || session.email,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        companyId: null, // System-level action
      },
    });

    // 9. إرجاع تأكيد بدون تنفيذ
    return NextResponse.json({
      success: true,
      status: "pending_manual_restore",
      message:
        "تم تسجيل طلب الاسترجاع للمراجعة اليدوية. لم يتم تعديل قاعدة البيانات. لحماية البيانات، ينفذ مسؤول السيرفر الاسترجاع بعد إنشاء نسخة أمان إضافية والتحقق من سلامة الملف.",
      backupFilename,
      requestedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating restore request:", error);
    // لا نعرض stack trace
    return NextResponse.json(
      { error: "Failed to create restore request" },
      { status: 500 }
    );
  }
}
