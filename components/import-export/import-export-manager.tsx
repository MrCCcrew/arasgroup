"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ImportResult {
  success: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ row: number; field?: string; message: string }>;
  error?: string;
}

interface EntityConfig {
  key: string;
  labelAr: string;
  description: string;
  apiPath: string;
  color: string;
  extraParams?: string; // appended to query string e.g. "&licenseType=owner-main"
}

interface Props {
  companyId: string;
}

const ENTITIES: EntityConfig[] = [
  {
    key: "employees",
    labelAr: "الموظفون",
    description: "موظفو الشركة من كل الأنواع (إداري، محاسب، مندوب...)",
    apiPath: "employees",
    color: "blue",
  },
  {
    key: "delivery-drivers",
    labelAr: "سائقو التوصيل",
    description: "السائقون المسجلون في منصات التوصيل (طلبات، RoPops...)",
    apiPath: "delivery-drivers",
    color: "orange",
  },
  {
    key: "investors",
    labelAr: "المسئولون والمديرون",
    description: "المستثمرون وأصحاب الفروع والشركات التابعة",
    apiPath: "investors",
    color: "purple",
  },
  {
    key: "investor-employees",
    labelAr: "موظفين وعمال المستثمرين",
    description: "الموظفون والعمال المرتبطون بالمسئولين (للحسابات والمطالبات)",
    apiPath: "investor-employees",
    color: "pink",
  },
  {
    key: "vehicles",
    labelAr: "المركبات",
    description: "مركبات الشركة (توصيل، غسيل، إدارية)",
    apiPath: "vehicles",
    color: "slate",
  },
  {
    key: "car-wash-vehicles",
    labelAr: "مركبات الغسيل",
    description: "مركبات قسم غسيل السيارات مع أكوادها وأسمائها",
    apiPath: "car-wash-vehicles",
    color: "cyan",
  },
  {
    key: "licenses-owner-main",
    labelAr: "تراخيص المالك الرئيسية",
    description: "التراخيص الرئيسية للشركة المملوكة للمالك مباشرةً",
    apiPath: "licenses",
    color: "emerald",
    extraParams: "&licenseType=owner-main",
  },
  {
    key: "licenses-owner-sub",
    labelAr: "تراخيص المالك الفرعية",
    description: "التراخيص الفرعية المرتبطة بترخيص رئيسي للمالك",
    apiPath: "licenses",
    color: "green",
    extraParams: "&licenseType=owner-sub",
  },
  {
    key: "licenses-investor-combined",
    labelAr: "تراخيص المسئولين الرئيسية والفرعية",
    description: "ملف موحد لتراخيص المسئولين والمديرين الرئيسية والفرعية بنفس ترتيب الأعمدة",
    apiPath: "licenses",
    color: "sky",
    extraParams: "&licenseType=investor-combined",
  },
  {
    key: "licenses-investor-main",
    labelAr: "تراخيص المسئولين الرئيسية",
    description: "التراخيص الرئيسية للمسئولين والمديرين المستثمرين",
    apiPath: "licenses",
    color: "violet",
    extraParams: "&licenseType=investor-main",
  },
  {
    key: "licenses-investor-sub",
    labelAr: "تراخيص المسئولين الفرعية",
    description: "التراخيص الفرعية المرتبطة بترخيص رئيسي لمسئول",
    apiPath: "licenses",
    color: "indigo",
    extraParams: "&licenseType=investor-sub",
  },
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    badge: "bg-blue-100 text-blue-700" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  badge: "bg-orange-100 text-orange-700" },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  badge: "bg-purple-100 text-purple-700" },
  pink:    { bg: "bg-pink-50",    border: "border-pink-200",    text: "text-pink-700",    badge: "bg-pink-100 text-pink-700" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   badge: "bg-slate-100 text-slate-700" },
  cyan:    { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-700",    badge: "bg-cyan-100 text-cyan-700" },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     badge: "bg-sky-100 text-sky-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  green:   { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-700",   badge: "bg-green-100 text-green-700" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  badge: "bg-violet-100 text-violet-700" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  badge: "bg-indigo-100 text-indigo-700" },
};

function EntityCard({ entity, companyId }: { entity: EntityConfig; companyId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const colors = COLOR_CLASSES[entity.color] ?? COLOR_CLASSES.blue;

  const baseUrl = `/api/import-export/${entity.apiPath}?companyId=${companyId}${entity.extraParams ?? ""}`;

  function download(mode: "template" | "export") {
    const a = document.createElement("a");
    a.href = `${baseUrl}&mode=${mode}`;
    a.download = "";
    a.click();
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setResult({ success: false, error: "يرجى رفع ملف Excel (.xlsx أو .xls)" });
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(baseUrl, {
        method: "POST",
        body: fd,
      });
      const data: ImportResult = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "فشل رفع الملف" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={`rounded-xl border ${colors.border} bg-card`}>
      {/* Header */}
      <div className={`flex items-center gap-3 rounded-t-xl ${colors.bg} px-5 py-4`}>
        <FileSpreadsheet size={20} className={colors.text} />
        <div className="flex-1">
          <h3 className={`font-bold ${colors.text}`}>{entity.labelAr}</h3>
          <p className="text-xs text-muted-foreground">{entity.description}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Download buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => download("template")}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            <Download size={14} />
            تحميل نموذج فارغ
          </button>
          <button
            onClick={() => download("export")}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            <Download size={14} />
            تصدير البيانات الحالية
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <Upload size={22} className="text-muted-foreground" />
          <p className="text-sm font-medium">اسحب ملف Excel هنا أو اضغط للاختيار</p>
          <p className="text-xs text-muted-foreground">يجب أن يكون بنفس هيكل النموذج المحمّل</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* Loading state */}
        {importing && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            جارٍ استيراد البيانات...
          </div>
        )}

        {/* Result */}
        {result && !importing && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-green-700">
                  <CheckCircle2 size={16} />
                  اكتمل الاستيراد
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(result.created ?? 0) > 0 && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">
                      ✓ {result.created} سجل جديد
                    </span>
                  )}
                  {(result.updated ?? 0) > 0 && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                      ↻ {result.updated} تم تحديثه
                    </span>
                  )}
                  {(result.skipped ?? 0) > 0 && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                      — {result.skipped} تم تجاهله
                    </span>
                  )}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <p className="flex items-center gap-1 font-medium text-amber-700">
                      <AlertCircle size={14} /> {result.errors.length} صف به أخطاء:
                    </p>
                    <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-700">
                      {result.errors.map((e, i) => <li key={i}>• {e.message}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-red-700">
                  <XCircle size={16} />
                  {result.error ?? "فشل الاستيراد — يرجى مراجعة الأخطاء"}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700">
                    {result.errors.map((e, i) => <li key={i}>• {e.message}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportExportManager({ companyId }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>تعليمات الاستيراد:</strong> حمّل النموذج الفارغ أولاً، أدخل البيانات من الصف الثالث، لا تغيّر الأعمدة أو ترتيبها، ثم ارفع الملف. الحقول المميزة بـ <strong>*</strong> إلزامية.
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ENTITIES.map((entity) => (
          <EntityCard key={entity.key} entity={entity} companyId={companyId} />
        ))}
      </div>
    </div>
  );
}
