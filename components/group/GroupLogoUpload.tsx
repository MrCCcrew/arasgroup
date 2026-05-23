"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Trash2, Upload } from "lucide-react";

interface Props {
  groupId: string;
  currentLogoUrl: string | null;
  groupName: string;
}

export function GroupLogoUpload({ groupId, currentLogoUrl, groupName }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/groups/${groupId}/logo`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      setLogoUrl(payload.data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("حذف شعار المجموعة؟")) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/logo`, { method: "DELETE" });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      {/* Logo preview */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`شعار ${groupName}`}
            fill
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera size={22} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">لا يوجد شعار</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">شعار المجموعة</p>
        <p className="text-xs text-muted-foreground">JPG · PNG · WebP · SVG — حد أقصى 2 ميجابايت</p>
        <p className="text-xs text-muted-foreground">يظهر في صفحة تسجيل الدخول</p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            onChange={handleUpload}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {uploading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Upload size={13} />
            )}
            {logoUrl ? "تغيير الشعار" : "رفع شعار"}
          </button>

          {logoUrl && (
            <button
              type="button"
              disabled={uploading}
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={13} />
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
