"use client";

import { useLocale } from "@/components/providers/locale-provider";

interface Props {
  backHref: string;
}

export function PrintControls({ backHref }: Props) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const printLabel = isEn ? "Print / PDF" : "\u0637\u0628\u0627\u0639\u0629 / PDF";
  const backLabel = isEn ? "Back" : "\u0631\u062c\u0648\u0639";

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        left: "1rem",
        display: "flex",
        gap: "0.5rem",
        zIndex: 100,
      }}
    >
      <button
        onClick={() => window.print()}
        style={{
          background: "#1d4ed8",
          color: "white",
          border: "none",
          padding: "0.5rem 1.2rem",
          borderRadius: "0.5rem",
          fontSize: "0.9rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {printLabel}
      </button>
      <a
        href={backHref}
        style={{
          background: "#6b7280",
          color: "white",
          padding: "0.5rem 1.2rem",
          borderRadius: "0.5rem",
          fontSize: "0.9rem",
          textDecoration: "none",
          fontFamily: "inherit",
        }}
      >
        {backLabel}
      </a>
    </div>
  );
}
