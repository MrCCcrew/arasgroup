"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="rounded border px-4 py-2 text-sm">
      {label}
    </button>
  );
}
