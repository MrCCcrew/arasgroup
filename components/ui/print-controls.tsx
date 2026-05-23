"use client";

interface Props {
  backHref: string;
}

export function PrintControls({ backHref }: Props) {
  return (
    <div style={{
      position: "fixed", top: "1rem", left: "1rem",
      display: "flex", gap: "0.5rem", zIndex: 100,
    }}>
      <button
        onClick={() => window.print()}
        style={{
          background: "#1d4ed8", color: "white", border: "none",
          padding: "0.5rem 1.2rem", borderRadius: "0.5rem",
          fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        🖨 طباعة / PDF
      </button>
      <a
        href={backHref}
        style={{
          background: "#6b7280", color: "white",
          padding: "0.5rem 1.2rem", borderRadius: "0.5rem",
          fontSize: "0.9rem", textDecoration: "none", fontFamily: "inherit",
        }}
      >
        ← رجوع
      </a>
    </div>
  );
}
