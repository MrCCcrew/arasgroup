"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface SalaryWhatsAppButtonProps {
  paymentId: string;
}

const AR = {
  buildFailed: "\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062a\u0633\u0627\u0628",
  phoneMissing: "\u0631\u0642\u0645 \u0647\u0627\u062a\u0641 \u0627\u0644\u0645\u0648\u0638\u0641 \u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631",
  unexpected: "\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639",
  preparing: "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0636\u064a\u0631...",
  whatsappPdf: "\u0648\u0627\u062a\u0633\u0627\u0628 PDF",
  arabicPdf: "\u0639\u0631\u0628\u064a PDF",
  englishPdf: "\u0625\u0646\u062c\u0644\u064a\u0632\u064a PDF",
} as const;

export function SalaryWhatsAppButton({ paymentId }: SalaryWhatsAppButtonProps) {
  const { locale } = useLocale();
  const [loadingLocale, setLoadingLocale] = useState<"ar" | "en" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSend(targetLocale: "ar" | "en") {
    try {
      setLoadingLocale(targetLocale);
      setMenuOpen(false);

      const response = await fetch(`/api/hr/salaries/whatsapp?paymentId=${paymentId}&locale=${targetLocale}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to build WhatsApp message" : AR.buildFailed));
      }

      if (!payload.data?.url) {
        window.alert(locale === "en" ? "Employee phone number is missing" : AR.phoneMissing);
        return;
      }

      window.open(payload.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : locale === "en" ? "Unexpected error" : AR.unexpected);
    } finally {
      setLoadingLocale(null);
    }
  }

  const currentLocale = locale === "en" ? "en" : "ar";
  const loading = loadingLocale !== null;

  return (
    <div ref={rootRef} className="relative inline-flex items-stretch">
      <button
        type="button"
        onClick={() => handleSend(currentLocale)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-s-lg rounded-e-none border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
      >
        <MessageCircle size={14} />
        {loading
          ? (locale === "en" ? "Preparing..." : AR.preparing)
          : (locale === "en" ? "WhatsApp PDF" : AR.whatsappPdf)}
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        disabled={loading}
        className="inline-flex items-center rounded-e-lg rounded-s-none border border-s-0 border-green-200 bg-green-50 px-2 text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
        aria-label={locale === "en" ? "Choose WhatsApp PDF language" : "اختيار لغة PDF للواتساب"}
      >
        <ChevronDown size={14} />
      </button>

      {menuOpen && (
        <div className="absolute end-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleSend("ar")}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs hover:bg-muted"
          >
            <span>{AR.arabicPdf}</span>
            <span className="text-muted-foreground">AR</span>
          </button>
          <button
            type="button"
            onClick={() => handleSend("en")}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs hover:bg-muted"
          >
            <span>{locale === "en" ? "English PDF" : AR.englishPdf}</span>
            <span className="text-muted-foreground">EN</span>
          </button>
        </div>
      )}
    </div>
  );
}
