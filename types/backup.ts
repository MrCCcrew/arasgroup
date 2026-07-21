/**
 * أنواع بيانات النسخ الاحتياطي
 */

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

export interface RestoreRequest {
  backupFilename: string;
  requestedBy: string;
  requestedAt: Date;
  confirmationPhrase: string;
  status: "pending_manual_restore";
}
