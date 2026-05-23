"use client";

import { Printer } from "lucide-react";

interface Props {
  label?: string;
  className?: string;
}

export function PrintButton({ label = "طباعة", className }: Props) {
  return (
    <button
      onClick={() => window.print()}
      className={className ?? "flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"}
    >
      <Printer size={16} />
      {label}
    </button>
  );
}
