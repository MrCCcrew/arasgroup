"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Trash2, ExternalLink, Paperclip } from "lucide-react";

interface Attachment {
  id: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
  documentCategory: string | null;
  notes: string | null;
  createdAt: Date;
}

interface Props {
  vehicleId: string;
  companyId: string;
  initialAttachments: Attachment[];
  docLabels: Record<string, string>;
}

const DOC_TYPES = [
  { value: "REGISTRATION_BOOK", label: "دفتر التسجيل" },
  { value: "LICENSE", label: "رخصة السيارة" },
  { value: "INSURANCE", label: "التأمين" },
  { value: "MUNICIPALITY_CARD", label: "بطاقة البلدية" },
  { value: "ADVERTISING_LICENSE", label: "ترخيص الإعلان" },
  { value: "FOOD_LICENSE", label: "ترخيص الأغذية" },
  { value: "OTHER", label: "أخرى" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string | null }) {
  const isPdf = mime === "application/pdf";
  const isImage = mime?.startsWith("image/");
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-red-100" : isImage ? "bg-blue-100" : "bg-muted"}`}>
      <FileText size={18} className={isPdf ? "text-red-600" : isImage ? "text-blue-600" : "text-muted-foreground"} />
    </div>
  );
}

export function VehicleAttachments({ vehicleId, companyId, initialAttachments, docLabels }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [docType, setDocType] = useState("REGISTRATION_BOOK");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentCategory", docType);
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch(`/api/vehicles/${vehicleId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      setAttachments((prev) => [payload.data, ...prev]);
      setNotes("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm("حذف هذا المرفق نهائياً؟")) return;
    setDeletingId(attachmentId);
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setDeletingId(null);
    }
  }

  // Group by docType
  const grouped: Record<string, Attachment[]> = {};
  for (const att of attachments) {
    const key = att.documentCategory ?? "OTHER";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(att);
  }

  return (
    <div className="section-card">
      <div className="flex items-center gap-2 mb-5">
        <Paperclip size={18} className="text-primary" />
        <h2 className="font-bold">المستندات والمرفقات</h2>
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
          {attachments.length} ملف
        </span>
      </div>

      {/* Upload Section */}
      <div className="bg-muted/30 rounded-xl p-4 mb-5 border border-dashed border-border">
        <p className="text-sm font-medium mb-3">رفع مستند جديد</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label text-xs">نوع المستند</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="input-field w-full text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">ملاحظة (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="مثال: 2024-2025"
            />
          </div>
          <div className="flex items-end">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={handleUpload}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Upload size={15} />
              )}
              {uploading ? "جاري الرفع..." : "اختيار ملف"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          PDF · JPG · PNG · Word — حد أقصى 20 ميجابايت
        </p>
        {uploadError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>
        )}
      </div>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">لا توجد مرفقات بعد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {DOC_TYPES.map((type) => {
            const items = grouped[type.value];
            if (!items?.length) return null;
            return (
              <div key={type.value}>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span>{type.label}</span>
                  <span className="bg-muted rounded-full px-1.5 py-0.5 normal-case font-normal">
                    {items.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {items.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                    >
                      <FileIcon mime={att.mimeType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.originalName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatSize(att.fileSize)}</span>
                          {att.notes && (
                            <span className="text-xs text-muted-foreground">· {att.notes}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            · {new Date(att.createdAt).toLocaleDateString("ar-KW")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="فتح"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          onClick={() => handleDelete(att.id)}
                          disabled={deletingId === att.id}
                          className="rounded-lg p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                          title="حذف"
                        >
                          {deletingId === att.id ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent block" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
