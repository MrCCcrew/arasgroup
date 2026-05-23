"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface SalaryWhatsAppButtonProps {
  paymentId: string;
}

export function SalaryWhatsAppButton({ paymentId }: SalaryWhatsAppButtonProps) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/whatsapp?paymentId=${paymentId}&locale=${locale}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to build WhatsApp message" : "تعذر إنشاء رسالة واتساب"));
      }

      if (!payload.data?.url) {
        window.alert(locale === "en" ? "Employee phone number is missing" : "رقم هاتف الموظف غير متوفر");
        return;
      }

      window.open(payload.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
    >
      <MessageCircle size={14} />
      {loading ? (locale === "en" ? "Preparing..." : "جاري التحضير...") : locale === "en" ? "WhatsApp" : "واتساب"}
    </button>
  );
}
