"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Database,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  FileText,
  HardDrive,
} from "lucide-react";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  isValid: boolean;
}

interface BackupStats {
  totalFiles: number;
  totalSize: number;
  latestBackup: BackupFile | null;
}

export function DatabaseBackup() {
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // تحميل قائمة النسخ
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      const response = await fetch("/api/admin/backups/list");

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("غير مصرح - يتطلب صلاحيات Super Admin");
        }
        throw new Error("فشل تحميل قائمة النسخ");
      }

      const data = await response.json();
      setFiles(data.files || []);
      setStats(data.stats || null);

      if (data.files.length === 0) {
        setMessage({
          type: "info",
          text: "لا توجد نسخ احتياطية متاحة حالياً. سيتم إنشاء النسخة الأولى تلقائياً الساعة 3:00 صباحاً.",
        });
      }
    } catch (error) {
      console.error("خطأ في تحميل النسخ:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "فشل تحميل قائمة النسخ الاحتياطية",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      setDownloadingFile(filename);
      setMessage(null);

      const response = await fetch(
        `/api/admin/backups/${encodeURIComponent(filename)}/download`
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("غير مصرح");
        }
        if (response.status === 404) {
          throw new Error("الملف غير موجود");
        }
        throw new Error("فشل تحميل الملف");
      }

      // تحميل الملف
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({
        type: "success",
        text: `تم تحميل النسخة الاحتياطية: ${filename}`,
      });
    } catch (error) {
      console.error("خطأ في التحميل:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "فشل تحميل النسخة الاحتياطية",
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="section-card">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Database size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-base">النسخ الاحتياطي</h2>
          <p className="text-xs text-muted-foreground">
            عرض وتحميل النسخ الاحتياطية المتوفرة
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : message.type === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <FileText size={16} />
          )}
          {message.text}
        </div>
      )}

      {/* إشعار مهم */}
      <div className="mb-4 p-4 bg-gradient-to-br from-purple-50/50 to-transparent border border-purple-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Clock size={18} className="text-purple-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">
              نسخ احتياطي تلقائي آمن
            </h4>
            <p className="text-xs text-purple-800">
              يتم إنشاء النسخ الاحتياطية تلقائياً بواسطة خدمة مستقلة على السيرفر يومياً
              الساعة 3:00 صباحاً. النسخ تُنشأ باستخدام mysqldump الأصلي لضمان الدقة والأمان.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && stats && stats.totalFiles > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-blue-50/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-blue-600" />
              <span className="text-xs text-muted-foreground">عدد النسخ</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{stats.totalFiles}</p>
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive size={14} className="text-emerald-600" />
              <span className="text-xs text-muted-foreground">الحجم الإجمالي</span>
            </div>
            <p className="text-xl font-bold text-emerald-900">
              {formatSize(stats.totalSize)}
            </p>
          </div>

          <div className="p-3 bg-amber-50/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-amber-600" />
              <span className="text-xs text-muted-foreground">آخر نسخة</span>
            </div>
            <p className="text-xs font-medium text-amber-900">
              {stats.latestBackup
                ? formatDate(stats.latestBackup.createdAt)
                : "-"}
            </p>
          </div>
        </div>
      )}

      {/* قائمة النسخ */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          لا توجد نسخ احتياطية متاحة حالياً
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.filename}
              className="p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600 shrink-0" />
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  {file.isValid && (
                    <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{formatDate(file.createdAt)}</span>
                  <span>•</span>
                  <span>{formatSize(file.size)}</span>
                </div>
              </div>

              <button
                onClick={() => handleDownload(file.filename)}
                disabled={downloadingFile === file.filename}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mr-2"
              >
                {downloadingFile === file.filename ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    جاري التحميل...
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    تحميل
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* تعليمات الاستعادة */}
      <div className="mt-4 p-4 border border-amber-200 bg-amber-50/50 rounded-lg">
        <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <AlertTriangle size={16} />
          استعادة النسخ الاحتياطية
        </h4>
        <p className="text-xs text-amber-800">
          لحماية البيانات، تتم عملية الاسترجاع من خلال مسؤول السيرفر بعد إنشاء نسخة أمان
          إضافة والتحقق من سلامة الملف. لا يتم تنفيذ الاستعادة تلقائياً من التطبيق.
        </p>
      </div>
    </div>
  );
}
