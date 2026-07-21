import "server-only";
import fs from "fs";
import path from "path";

/**
 * نظام النسخ الاحتياطي الآمن - Server Only
 *
 * هذا الملف يتعامل مع النسخ الاحتياطية الموجودة على السيرفر
 * في المجلد: /var/backups/arasgroup/database/
 *
 * النسخ يتم إنشاؤها خارج Next.js عبر:
 * - Script: /opt/arasgroup-backup/backup.sh
 * - Cron يومي الساعة 3 صباحاً
 * - يستخدم mysqldump الحقيقي
 *
 * هذا الكود READ-ONLY فقط - لا ينشئ أو يعدل نسخ
 */

// نمط اسم الملف المسموح به فقط
const BACKUP_FILENAME_PATTERN = /^rashidgroup_db_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql\.gz$/;

// المجلد الافتراضي (يمكن تجاوزه عبر env var)
const DEFAULT_BACKUP_DIR = "/var/backups/arasgroup/database";

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: Date;
  isValid: boolean;
}

export interface BackupStats {
  totalFiles: number;
  totalSize: number;
  latestBackup: BackupFile | null;
  oldestBackup: BackupFile | null;
}

/**
 * الحصول على مجلد النسخ الاحتياطية
 */
export function getBackupDirectory(): string {
  return process.env.ARASGROUP_BACKUP_DIR || DEFAULT_BACKUP_DIR;
}

/**
 * التحقق من صحة اسم الملف
 * - يجب أن يطابق النمط المحدد
 * - لا يحتوي على path separators
 * - لا يحتوي على ..
 */
export function validateBackupFilename(filename: string): boolean {
  // 1. تحقق من النمط
  if (!BACKUP_FILENAME_PATTERN.test(filename)) {
    return false;
  }

  // 2. تحقق من عدم وجود path separators أو traversal
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes("\0")
  ) {
    return false;
  }

  // 3. تحقق من أن basename مطابق للاسم الأصلي
  if (path.basename(filename) !== filename) {
    return false;
  }

  return true;
}

/**
 * تحويل اسم الملف الآمن إلى مسار كامل مع التحقق
 *
 * @throws Error إذا كان الاسم غير آمن أو المسار خارج المجلد
 */
export function resolveBackupPath(filename: string): string {
  // 1. التحقق من صحة الاسم
  if (!validateBackupFilename(filename)) {
    throw new Error("Invalid backup filename");
  }

  const backupDir = getBackupDirectory();
  const fullPath = path.join(backupDir, filename);
  const resolvedPath = path.resolve(fullPath);
  const resolvedDir = path.resolve(backupDir);

  // 2. التحقق من أن المسار داخل المجلد
  const relativePath = path.relative(resolvedDir, resolvedPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    resolvedPath !== path.join(resolvedDir, filename)
  ) {
    throw new Error("Path traversal detected");
  }

  // 3. التحقق من أن الملف ليس symlink
  try {
    const stats = fs.lstatSync(resolvedPath);
    if (stats.isSymbolicLink()) {
      throw new Error("Symlink not allowed");
    }
    if (!stats.isFile()) {
      throw new Error("Not a regular file");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Backup file not found");
    }
    throw error;
  }

  return resolvedPath;
}

/**
 * قراءة قائمة النسخ الاحتياطية من المجلد
 *
 * في بيئة التطوير، إذا كان المجلد غير موجود، يرجع قائمة فارغة
 */
export async function listBackupFiles(): Promise<BackupFile[]> {
  const backupDir = getBackupDirectory();

  // تحقق من وجود المجلد
  if (!fs.existsSync(backupDir)) {
    // في Development: قائمة فارغة
    if (process.env.NODE_ENV === "development") {
      return [];
    }
    // في Production: خطأ
    throw new Error("Backup directory not found");
  }

  try {
    const files = fs.readdirSync(backupDir);
    const backups: BackupFile[] = [];

    for (const filename of files) {
      // تحقق من صحة الاسم
      if (!validateBackupFilename(filename)) {
        continue;
      }

      const fullPath = path.join(backupDir, filename);

      try {
        const stats = fs.lstatSync(fullPath);

        // تجاهل symlinks والمجلدات
        if (stats.isSymbolicLink() || !stats.isFile()) {
          continue;
        }

        backups.push({
          filename,
          size: stats.size,
          createdAt: stats.mtime,
          isValid: stats.size > 0,
        });
      } catch {
        // تجاهل الملفات التي لا يمكن قراءتها
        continue;
      }
    }

    // ترتيب حسب التاريخ (الأحدث أولاً)
    return backups.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  } catch (error) {
    console.error("Error listing backups:", error);
    throw new Error("Failed to list backup files");
  }
}

/**
 * الحصول على إحصائيات النسخ الاحتياطية
 */
export async function getBackupStats(): Promise<BackupStats> {
  const files = await listBackupFiles();

  if (files.length === 0) {
    return {
      totalFiles: 0,
      totalSize: 0,
      latestBackup: null,
      oldestBackup: null,
    };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return {
    totalFiles: files.length,
    totalSize,
    latestBackup: files[0] || null,
    oldestBackup: files[files.length - 1] || null,
  };
}

/**
 * الحصول على metadata لملف واحد
 */
export async function getBackupMetadata(
  filename: string
): Promise<BackupFile | null> {
  try {
    const fullPath = resolveBackupPath(filename);
    const stats = fs.lstatSync(fullPath);

    return {
      filename,
      size: stats.size,
      createdAt: stats.mtime,
      isValid: stats.size > 0 && stats.isFile(),
    };
  } catch {
    return null;
  }
}
