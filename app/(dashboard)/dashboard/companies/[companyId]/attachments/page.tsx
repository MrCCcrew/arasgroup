"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  File,
  FileSpreadsheet,
  FileText,
  Filter,
  Trash2,
  Upload,
  X,
  Eye,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number;
  filePath: string;
  entityType: string | null;
  entityId: string | null;
  attachmentType: string | null;
  refModule: string;
  notes: string | null;
  createdAt: string;
  uploadedBy: { nameAr: string; nameEn: string | null };
}

const ENTITY_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  EMPLOYEE: { ar: "موظف", en: "Employee" },
  COMPANY: { ar: "شركة", en: "Company" },
  INVESTOR: { ar: "مستثمر", en: "Investor" },
  BRANCH: { ar: "فرع", en: "Branch" },
  JOURNAL_ENTRY: { ar: "قيد محاسبي", en: "Journal Entry" },
  DRIVER: { ar: "سائق", en: "Driver" },
  VEHICLE: { ar: "مركبة", en: "Vehicle" },
  EXPENSE: { ar: "مصروف", en: "Expense" },
  LICENSE: { ar: "ترخيص", en: "License" },
  OTHER: { ar: "أخرى", en: "Other" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-GB" : "ar-KW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <span className="text-2xl">🖼</span>;
  if (type === "application/pdf") return <FileText className="h-7 w-7 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel"))
    return <FileSpreadsheet className="h-7 w-7 text-green-600" />;
  return <File className="h-7 w-7 text-gray-500" />;
}

function AttachmentCard({
  attachment,
  onDelete,
  onPreview,
  locale,
}: {
  attachment: Attachment;
  onDelete: (a: Attachment) => void;
  onPreview: (a: Attachment) => void;
  locale: "ar" | "en";
}) {
  const isImage = attachment.fileType.startsWith("image/");
  const entityLabel =
    attachment.entityType
      ? (ENTITY_TYPE_LABELS[attachment.entityType]?.[locale] ?? attachment.entityType)
      : null;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-muted/20 transition-colors hover:border-primary/50"
      onClick={() => onPreview(attachment)}
    >
      {isImage ? (
        <img
          src={attachment.filePath}
          alt={attachment.originalName}
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-muted/40">
          <FileIcon type={attachment.fileType} />
        </div>
      )}
      <div className="p-2 space-y-0.5">
        <p className="truncate text-xs font-medium">{attachment.originalName}</p>
        <p className="text-xs text-muted-foreground">{formatSize(attachment.fileSize)}</p>
        {entityLabel && (
          <p className="text-xs text-muted-foreground">{entityLabel}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDate(attachment.createdAt, locale)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(attachment);
        }}
        className="absolute left-1 top-1 rounded-md bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        title={locale === "en" ? "Delete" : "حذف"}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function CompanyAttachmentsPage() {
  const params = useParams<{ companyId: string }>();
  const { companyId } = params;
  const { locale } = useLocale();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/companies/${companyId}/attachments${filterType ? `?entityType=${filterType}` : ""}`;
    const res = await fetch(url);
    const payload = await res.json();
    if (payload.success) setAttachments(payload.data);
    setLoading(false);
  }, [companyId, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", companyId);
      formData.append("entityType", "COMPANY");
      formData.append("entityId", companyId);
      formData.append("refModule", "COMPANY");
      formData.append("refId", companyId);
      const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      await load();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : locale === "en" ? "Upload failed" : "فشل الرفع"
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(attachment: Attachment) {
    const confirmed = window.confirm(
      locale === "en"
        ? `Delete "${attachment.originalName}"?`
        : `حذف "${attachment.originalName}"؟`
    );
    if (!confirmed) return;
    await fetch(`/api/companies/${companyId}/attachments?id=${attachment.id}`, {
      method: "DELETE",
    });
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
  }

  const entityTypes = Array.from(
    new Set(attachments.map((a) => a.entityType).filter(Boolean) as string[])
  );

  const filtered = filterType
    ? attachments.filter((a) => a.entityType === filterType)
    : attachments;

  return (
    <div>
      <Header
        title={locale === "en" ? "Company Attachments" : "مرفقات الشركة"}
        subtitle={
          locale === "en"
            ? "All documents and files for this company"
            : "جميع المستندات والملفات الخاصة بالشركة"
        }
        companyId={companyId}
      />

      <div className="page-container space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-muted-foreground" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">
                {locale === "en" ? "All types" : "جميع الأنواع"}
              </option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]?.[locale] ?? type}
                </option>
              ))}
            </select>
          </div>

          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ms-auto ${
              uploading
                ? "pointer-events-none opacity-50 bg-primary/50 text-primary-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            <Upload size={15} />
            {uploading
              ? locale === "en"
                ? "Uploading..."
                : "جاري الرفع..."
              : locale === "en"
              ? "Upload file"
              : "رفع ملف"}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
            />
          </label>
        </div>

        {/* Content */}
        <div className="section-card">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {locale === "en" ? "Loading..." : "جاري التحميل..."}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {locale === "en" ? "No attachments found" : "لا توجد مرفقات"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onDelete={handleDelete}
                  onPreview={setPreview}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {locale === "en"
            ? `${filtered.length} attachment${filtered.length !== 1 ? "s" : ""}`
            : `${filtered.length} مرفق`}
        </p>
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b p-4">
              <p className="text-sm font-medium">{preview.originalName}</p>
              <div className="flex items-center gap-2">
                <a
                  href={preview.filePath}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  <Eye size={13} />
                  {locale === "en" ? "Open / Print" : "فتح / طباعة"}
                </a>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-1.5 hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex min-h-[300px] items-center justify-center p-4">
              {preview.fileType.startsWith("image/") ? (
                <img
                  src={preview.filePath}
                  alt={preview.originalName}
                  className="max-h-[70vh] max-w-full rounded-lg object-contain"
                />
              ) : preview.fileType === "application/pdf" ? (
                <iframe
                  src={preview.filePath}
                  className="h-[70vh] w-full rounded-lg"
                  title={preview.originalName}
                />
              ) : (
                <div className="space-y-3 text-center">
                  <FileText size={48} className="mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {locale === "en"
                      ? "Preview not available for this file type"
                      : "المعاينة غير متاحة لهذا النوع"}
                  </p>
                  <a
                    href={preview.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    <Eye size={14} />
                    {locale === "en" ? "Download / Open" : "تحميل / فتح"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
