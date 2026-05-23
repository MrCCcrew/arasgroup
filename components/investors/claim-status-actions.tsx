"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";

interface ClaimStatusActionsProps {
  claimId: string;
  status: string;
}

const FINAL_STATUSES = new Set(["PAID", "RENEWED", "SETTLED", "CANCELLED"]);

export function ClaimStatusActions({ claimId, status }: ClaimStatusActionsProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const labels = {
    send: locale === "en" ? "Send to accountant" : "إرسال للمحاسب",
    collect: locale === "en" ? "Collected" : "تم التحصيل",
    pay: locale === "en" ? "Paid" : "تم الدفع",
    renew: locale === "en" ? "Renewed" : "تم التجديد",
    cancel: locale === "en" ? "Cancel" : "إلغاء",
  };

  async function runAction(action: "SEND_TO_ACCOUNTANT" | "COLLECT" | "PAY" | "RENEW" | "CANCEL") {
    try {
      setLoadingAction(action);
      const response = await fetch(`/api/investors/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to update claim" : "تعذر تحديث المطالبة"));
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoadingAction(null);
    }
  }

  const buttons: Array<{ action: "SEND_TO_ACCOUNTANT" | "COLLECT" | "PAY" | "RENEW" | "CANCEL"; label: string; tone: string }> = [];

  if (status === "PENDING" || status === "OVERDUE") {
    buttons.push({ action: "SEND_TO_ACCOUNTANT", label: labels.send, tone: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" });
  }
  if (status === "SENT_TO_ACCOUNTANT" || status === "PARTIALLY_COLLECTED") {
    buttons.push({ action: "COLLECT", label: labels.collect, tone: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" });
  }
  if (status === "COLLECTED") {
    buttons.push({ action: "PAY", label: labels.pay, tone: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100" });
    buttons.push({ action: "RENEW", label: labels.renew, tone: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100" });
  }
  if (!FINAL_STATUSES.has(status)) {
    buttons.push({ action: "CANCEL", label: labels.cancel, tone: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" });
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => runAction(button.action)}
          disabled={loadingAction !== null}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${button.tone}`}
        >
          {loadingAction === button.action
            ? locale === "en"
              ? "Saving..."
              : "جاري الحفظ..."
            : button.label}
        </button>
      ))}
    </div>
  );
}
