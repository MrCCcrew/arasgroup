"use client";

import { useState } from "react";
import { Download, Upload, Database, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePassword, setRestorePassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

      setMessage({ type: "success", text: "تم تصدير النسخة الاحتياطية بنجاح" });
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".json")) {
        setMessage({ type: "error", text: "يجب اختيار ملف بصيغة .json" });
        return;
      }
      setSelectedFile(file);
      setMessage(null);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "الرجاء اختيار ملف النسخة الاحتياطية" });
      return;
    }

    if (!restorePassword) {
      setMessage({ type: "error", text: "الرجاء إدخال كلمة السر" });
      return;
    }

    // تأكيد الاستعادة
    const confirmed = window.confirm(
      "⚠️ تحذير: ستتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية.\n\nهل أنت متأكد من المتابعة؟"
    );

    if (!confirmed) return;

    try {
      setIsRestoring(true);
      setMessage(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("password", restorePassword);

      const response = await fetch("/api/admin/backup/restore", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "فشل الاستعادة");
      }

      setMessage({ type: "success", text: result.message });
      setRestorePassword("");
      setSelectedFile(null);

      // إعادة تحميل الصفحة بعد 2 ثانية
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error("خطأ في الاستعادة:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "فشل استعادة النسخة الاحتياطية",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="section-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
          <Database size={20} className="text-amber-600" />
        </div>
        <div>
          <h2 className="font-bold text-base">النسخ الاحتياطي والاستعادة</h2>
          <p className="text-xs text-muted-foreground">
            إدارة النسخ الاحتياطية لقاعدة البيانات
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
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          {message.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* قسم التصدير */}
        <div className="p-4 border border-border rounded-lg">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Download size={16} className="text-primary" />
            تصدير نسخة احتياطية
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            قم بتصدير نسخة احتياطية كاملة من قاعدة البيانات إلى جهازك
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري التصدير...
              </>
            ) : (
              <>
                <Download size={16} />
                تصدير النسخة الاحتياطية
              </>
            )}
          </button>
        </div>

        {/* قسم الاستعادة */}
        <div className="p-4 border border-border rounded-lg bg-amber-50/50">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Upload size={16} className="text-amber-600" />
            استعادة نسخة احتياطية
          </h3>

          <div className="space-y-3">
            <div>
              <label htmlFor="backup-file" className="block text-xs font-medium mb-1">
                اختر ملف النسخة الاحتياطية (.json)
              </label>
              <input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="input-field w-full text-sm"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  الملف المحدد: {selectedFile.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="restore-password" className="block text-xs font-medium mb-1">
                كلمة السر للاستعادة
              </label>
              <input
                id="restore-password"
                type="password"
                placeholder="أدخل كلمة السر"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div className="bg-amber-100 border border-amber-300 rounded p-2 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-700 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>تحذير:</strong> ستتم استبدال جميع البيانات الحالية
              </p>
            </div>

            <button
              onClick={handleRestore}
              disabled={isRestoring || !selectedFile || !restorePassword}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  جاري الاستعادة...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  استعادة النسخة الاحتياطية
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <h4 className="text-xs font-semibold mb-2">ملاحظات مهمة:</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>يتم تصدير جميع الجداول والبيانات بالكامل</li>
          <li>احفظ النسخة الاحتياطية في مكان آمن</li>
          <li>يُنصح بإنشاء نسخة احتياطية قبل أي تحديثات كبيرة</li>
          <li>عملية الاستعادة ستحذف جميع البيانات الحالية وتستبدلها بالنسخة الاحتياطية</li>
          <li>كلمة السر المطلوبة للاستعادة هي: <code className="bg-muted px-1 rounded">T@mer2026</code></li>
        </ul>
      </div>
    </div>
  );
}
