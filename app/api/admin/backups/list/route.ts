import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import {
  listBackupFiles,
  getBackupStats,
} from "@/lib/backup/server-backups";

export async function GET() {
  try {
    // التحقق من المصادقة
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // التحقق من الصلاحيات
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin only" },
        { status: 403 }
      );
    }

    // قراءة قائمة النسخ
    const files = await listBackupFiles();
    const stats = await getBackupStats();

    return NextResponse.json({
      files: files.map((file) => ({
        filename: file.filename,
        size: file.size,
        createdAt: file.createdAt.toISOString(),
        isValid: file.isValid,
      })),
      stats: {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        latestBackup: stats.latestBackup
          ? {
              filename: stats.latestBackup.filename,
              size: stats.latestBackup.size,
              createdAt: stats.latestBackup.createdAt.toISOString(),
              isValid: stats.latestBackup.isValid,
            }
          : null,
        oldestBackup: stats.oldestBackup
          ? {
              filename: stats.oldestBackup.filename,
              size: stats.oldestBackup.size,
              createdAt: stats.oldestBackup.createdAt.toISOString(),
              isValid: stats.oldestBackup.isValid,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error listing backups:", error);
    // لا نعرض stack trace
    return NextResponse.json(
      { error: "Failed to list backups" },
      { status: 500 }
    );
  }
}
