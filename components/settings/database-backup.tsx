"use client";

import { useState } from "react";
import { Download, Database, CheckCircle2, Loader2, Cloud, Clock } from "lucide-react";

export function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isAutoBackup, setIsAutoBackup] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage(null);

      const response = await fetch("/api/admin/backup/export", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشل التصدير");
      }

      // تحميل الملف
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // استخراج اسم الملف من headers
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `backup_${new Date().toISOString()}.sql`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: "success", text: "تم تصدير النسخة الاحتياطية بنجاح بصيغة SQL" });
    } catch (error) {
      console.error("خطأ في التصدير:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "فشل تصدير النسخة الاحتياطية",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAutoBackup = async () => {
    try {
      setIsAutoBackup(true);
      setMessage(null);

      const response = await fetch("/api/admin/backup/auto", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "فشل النسخ الاحتياطي");
      }

      setMessage({
        type: "success",
        text: `تم رفع النسخة الاحتياطية إلى السحابة بنجاح (${(result.size / 1024 / 1024).toFixed(2)} MB)`
      });
    } catch (error) {
      console.error("خطأ في النسخ الاحتياطي:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "فشل النسخ الاحتياطي",
      });
    } finally {
      setIsAutoBackup(false);
    }
  };

  return (
    <div className="section-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Database size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-base">النسخ الاحتياطي</h2>
          <p className="text-xs text-muted-foreground">
            نسخ احتياطي يدوي وأوتوماتيكي لقاعدة البيانات
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <CheckCircle2 size={16} />
          {message.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* نسخة احتياطية يدوية - تحميل لجهازك */}
        <div className="p-4 border border-border rounded-lg bg-gradient-to-br from-blue-50/50 to-transparent">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Download size={16} className="text-blue-600" />
            نسخة احتياطية يدوية
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            تصدير SQL كامل وتحميله إلى جهازك مباشرة
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري التصدير...
              </>
            ) : (
              <>
                <Download size={16} />
                تحميل النسخة الاحتياطية
              </>
            )}
          </button>
        </div>

        {/* نسخة احتياطية أوتوماتيكية - رفع للسحابة */}
        <div className="p-4 border border-border rounded-lg bg-gradient-to-br from-emerald-50/50 to-transparent">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Cloud size={16} className="text-emerald-600" />
            نسخة احتياطية سحابية
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            رفع النسخة الاحتياطية إلى Cloudflare R2
          </p>
          <button
            onClick={handleAutoBackup}
            disabled={isAutoBackup}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoBackup ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <Cloud size={16} />
                رفع إلى السحابة
              </>
            )}
          </button>
        </div>
      </div>

      {/* معلومات النسخ الاحتياطي الأوتوماتيكي */}
      <div className="mt-4 p-4 bg-gradient-to-br from-purple-50/50 to-transparent border border-purple-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Clock size={18} className="text-purple-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">
              نسخ احتياطي يومي تلقائي
            </h4>
            <p className="text-xs text-purple-800 mb-3">
              يتم إنشاء نسخة احتياطية تلقائياً كل يوم الساعة 2:00 صباحاً ورفعها إلى Cloudflare R2
            </p>
            <div className="bg-purple-100 rounded p-2">
              <p className="text-xs text-purple-900 font-mono">
                <strong>Cron:</strong> 0 2 * * * curl http://localhost:3000/api/cron/daily-backup
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ملاحظات مهمة */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <h4 className="text-xs font-semibold mb-2">📋 ملاحظات مهمة:</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>النسخ الاحتياطية بصيغة SQL القياسية (متوافقة مع MySQL)</li>
          <li>احفظ النسخة المحلية في مكان آمن ومشفر</li>
          <li>النسخ السحابية تُحفظ في مجلد <code className="bg-muted px-1 rounded">backups/</code> على R2</li>
          <li>للاستعادة: استخدم phpMyAdmin أو MySQL CLI على السيرفر مباشرة</li>
          <li>⚠️ <strong>الاستعادة الأوتوماتيكية معطلة للأمان</strong> - تتم يدوياً فقط</li>
        </ul>
      </div>

      {/* تعليمات الاستعادة اليدوية */}
      <div className="mt-4 p-4 border border-amber-200 bg-amber-50/50 rounded-lg">
        <h4 className="text-sm font-semibold text-amber-900 mb-2">
          🔧 كيفية استعادة النسخة الاحتياطية (يدوياً على السيرفر):
        </h4>
        <div className="space-y-2 text-xs text-amber-800">
          <p><strong>1.</strong> إيقاف التطبيق مؤقتاً:</p>
          <code className="block bg-amber-100 p-2 rounded font-mono">pm2 stop arasgroup</code>

          <p className="pt-2"><strong>2.</strong> استعادة النسخة الاحتياطية:</p>
          <code className="block bg-amber-100 p-2 rounded font-mono">
            mysql -u username -p database_name &lt; backup.sql
          </code>

          <p className="pt-2"><strong>3.</strong> إعادة تشغيل التطبيق:</p>
          <code className="block bg-amber-100 p-2 rounded font-mono">pm2 start arasgroup</code>
        </div>
      </div>
    </div>
  );
}
