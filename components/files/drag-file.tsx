"use client";

import type { DragEvent } from "react";
import { GripVertical } from "lucide-react";

// Lets a stored file be dragged out of the page like a normal file:
// - onto the desktop / a folder  → Chrome & Edge save it (DownloadURL)
// - into another site or app that accepts links → it receives the file link
export function fileDragProps(url: string, name: string, type?: string | null) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      const absolute = new URL(url, window.location.href).href;
      const safeName = (name || "file").replace(/[:\\/\r\n]+/g, "-");
      const mime = type || "application/octet-stream";
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("DownloadURL", `${mime}:${safeName}:${absolute}`);
      event.dataTransfer.setData("text/uri-list", absolute);
      event.dataTransfer.setData("text/plain", absolute);
    },
  };
}

// Visible handle for files whose preview can't be dragged itself (PDF viewer, other types).
export function DragFileHandle({ url, name, type, en = false }: { url: string; name: string; type?: string | null; en?: boolean }) {
  return (
    <span
      {...fileDragProps(url, name, type)}
      title={en ? "Drag this to your desktop or a folder to copy the file" : "اسحب من هنا وارميه على سطح المكتب أو أي فولدر علشان يتنسخ الملف"}
      className="inline-flex cursor-grab select-none items-center gap-1 rounded-lg border border-dashed border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 active:cursor-grabbing"
    >
      <GripVertical size={13} />
      {en ? "Drag file" : "اسحب الملف"}
    </span>
  );
}
