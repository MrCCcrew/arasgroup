"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface Props {
  url: string;
  filename?: string;
  label?: string;
  labelAr?: string;
}

export function ExcelDownloadButton({ url, filename, label = "Excel", labelAr }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        window.alert(payload.error ?? "فشل في التصدير");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename ?? "export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.alert("فشل في تصدير الملف");
    } finally {
      setLoading(false);
    }
  }

  const displayLabel = labelAr ?? label;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50"
    >
      <Download size={16} />
      {loading ? "..." : displayLabel}
    </button>
  );
}
