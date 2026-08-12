"use client";

import { Eye, X } from "lucide-react";
import { useState } from "react";

export function MovementImageViewer({ imageUrl, label = "صورة الفاتورة" }: { imageUrl: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!imageUrl) return <span className="text-xs text-muted-foreground">-</span>;
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"><Eye size={14} />{label}</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}><div className="relative max-h-[90vh] max-w-3xl overflow-auto" onClick={(event) => event.stopPropagation()}><button onClick={() => setOpen(false)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-black"><X size={18} /></button>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={imageUrl} alt={label} className="max-h-[88vh] rounded-lg" /></div></div>}
  </>;
}
