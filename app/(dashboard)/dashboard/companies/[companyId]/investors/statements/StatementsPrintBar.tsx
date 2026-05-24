"use client";

import { Printer } from "lucide-react";

export function StatementsPrintBar() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
    >
      <Printer size={14} />
      طباعة / PDF
    </button>
  );
}
