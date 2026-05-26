"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, CheckCircle, Send, Banknote, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface ClaimLine {
  id: string;
  descriptionAr: string;
  actualAmount: number;
  collectedAmount: number;
}

interface ClaimStatusActionsProps {
  claimId: string;
  status: string;
  canCollect: boolean;
  canAdmin: boolean;
  investorPhone: string | null;
  investorName: string;
  claimType: string;
  claimDescription: string;
  claimLines: ClaimLine[];
  dueDate: string | null;
  totalActual: number;
}

const FINAL_STATUSES = new Set(["COMPLETED", "PAID", "RENEWED", "SETTLED", "CANCELLED"]);

// ── رسائل الواتساب حسب نوع المطالبة ─────────────────────────────
function buildWhatsAppMessage(
  investorName: string,
  claimType: string,
  claimDescription: string,
  totalActual: number,
  dueDate: string | null,
  locale: "ar" | "en",
): string {
  const typeLabels: Record<string, { ar: string; en: string }> = {
    LICENSE_RENEWAL:  { ar: "تجديد رخصة",    en: "License Renewal" },
    RESIDENCY_RENEWAL:{ ar: "تجديد إقامة",   en: "Residency Renewal" },
    RENT:             { ar: "إيجار",          en: "Rent" },
    SALARY_FUNDING:   { ar: "تمويل رواتب",   en: "Salary Funding" },
    ADMIN_FEE:        { ar: "رسوم إدارية",   en: "Administrative Fee" },
    FINE:             { ar: "غرامة",          en: "Fine" },
    OTHER:            { ar: "أخرى",           en: "Other" },
  };

  const typeAr = typeLabels[claimType]?.ar ?? claimType;
  const typeEn = typeLabels[claimType]?.en ?? claimType;
  const amountFormatted = totalActual.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const arabicMsg = [
    `السلام عليكم ورحمة الله وبركاته`,
    `عزيزي ${investorName}،`,
    ``,
    `تود مجموعة عبد الفتاح راشد سليمان إعلامكم بمطالبة مالية جديدة:`,
    `📋 النوع: ${typeAr}`,
    `📝 البيان: ${claimDescription}`,
    `💰 المبلغ المطلوب: ${amountFormatted} د.ك`,
    ...(dueDate ? [`📅 تاريخ الاستحقاق: ${dueDate}`] : []),
    ``,
    `نرجو تسديد المبلغ المطلوب في أقرب وقت ممكن.`,
    `شكراً لتعاونكم وحسن تجاوبكم.`,
  ].join("\n");

  const englishMsg = [
    `Dear ${investorName},`,
    ``,
    `Abdul Fattah Rashid Suleiman Group would like to inform you of a new financial claim:`,
    `📋 Type: ${typeEn}`,
    `📝 Description: ${claimDescription}`,
    `💰 Amount Due: KD ${amountFormatted}`,
    ...(dueDate ? [`📅 Due Date: ${dueDate}`] : []),
    ``,
    `Please arrange payment at your earliest convenience.`,
    `Thank you for your cooperation.`,
  ].join("\n");

  return `${arabicMsg}\n\n─────────────────\n\n${englishMsg}`;
}

// ── مودال تسجيل التحصيل ──────────────────────────────────────────
function CollectModal({
  lines,
  onClose,
  onConfirm,
  loading,
}: {
  lines: ClaimLine[];
  onClose: () => void;
  onConfirm: (collectedLines: { lineId: string; collectedAmount: number }[]) => void;
  loading: boolean;
}) {
  const { locale } = useLocale();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.actualAmount)]))
  );

  function setAmount(lineId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [lineId]: value }));
  }

  function handleConfirm() {
    const collectedLines = lines.map((l) => ({
      lineId: l.id,
      collectedAmount: parseFloat(amounts[l.id] ?? "0") || 0,
    }));
    onConfirm(collectedLines);
  }

  const total = lines.reduce((s, l) => s + (parseFloat(amounts[l.id] ?? "0") || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-bold">{locale === "en" ? "Record Collection" : "تسجيل التحصيل"}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Enter the collected amount for each line item:"
              : "أدخل المبلغ المحصل لكل بند:"}
          </p>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <p className="text-sm font-medium">{line.descriptionAr}</p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "en" ? "Required:" : "المطلوب:"}{" "}
                    <span className="number">{line.actualAmount.toFixed(3)}</span>
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {locale === "en" ? "Collected" : "المحصل"}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={amounts[line.id] ?? ""}
                    onChange={(e) => setAmount(line.id, e.target.value)}
                    className="input-field w-full"
                    dir="ltr"
                    placeholder="0.000"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-teal-800">
              {locale === "en" ? "Total Collected:" : "إجمالي المحصل:"}
            </span>
            <span className="number font-bold text-teal-700">{total.toFixed(3)} {locale === "en" ? "KD" : "د.ك"}</span>
          </div>
        </div>

        <div className="flex gap-2 border-t p-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading
              ? (locale === "en" ? "Saving..." : "جاري الحفظ...")
              : (locale === "en" ? "Confirm Collection" : "تأكيد التحصيل")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────
export function ClaimStatusActions({
  claimId,
  status,
  canCollect,
  canAdmin,
  investorPhone,
  investorName,
  claimType,
  claimDescription,
  claimLines,
  dueDate,
  totalActual,
}: ClaimStatusActionsProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [error, setError] = useState("");

  if (FINAL_STATUSES.has(status)) return null;

  async function runAction(
    action: string,
    extra?: { collectedLines?: { lineId: string; collectedAmount: number }[] },
  ) {
    try {
      setLoadingAction(action);
      setError("");
      const response = await fetch(`/api/investors/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Failed" : "حدث خطأ"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoadingAction(null);
    }
  }

  function openWhatsApp() {
    const message = buildWhatsAppMessage(investorName, claimType, claimDescription, totalActual, dueDate, locale as "ar" | "en");
    const phone = investorPhone?.replace(/\D/g, "") ?? "";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    // تحديث الحالة إلى "أُرسل للمسئول"
    runAction("SEND_TO_INVESTOR");
  }

  return (
    <>
      {showCollectModal && (
        <CollectModal
          lines={claimLines}
          loading={loadingAction === "COLLECT"}
          onClose={() => setShowCollectModal(false)}
          onConfirm={(collectedLines) => {
            setShowCollectModal(false);
            runAction("COLLECT", { collectedLines });
          }}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {/* شؤون إدارية: إرسال للمحاسب */}
        {canAdmin && (status === "PENDING" || status === "OVERDUE") && (
          <button
            type="button"
            onClick={() => runAction("SEND_TO_ACCOUNTANT")}
            disabled={loadingAction !== null}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
          >
            <Send size={12} />
            {loadingAction === "SEND_TO_ACCOUNTANT"
              ? (locale === "en" ? "Sending..." : "جاري الإرسال...")
              : (locale === "en" ? "Send to accountant" : "إرسال للمحاسب")}
          </button>
        )}

        {/* محاسب: إرسال واتساب للمسئول */}
        {canCollect && status === "SENT_TO_ACCOUNTANT" && (
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={loadingAction !== null}
            className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            title={!investorPhone ? (locale === "en" ? "No phone number registered" : "لا يوجد رقم هاتف مسجل") : undefined}
          >
            <MessageCircle size={12} />
            {locale === "en" ? "Send WhatsApp" : "إرسال واتساب"}
            {!investorPhone && <span className="text-red-500 mr-1">(!)</span>}
          </button>
        )}

        {/* محاسب: تسجيل التحصيل */}
        {canCollect && (status === "SENT_TO_ACCOUNTANT" || status === "SENT_TO_INVESTOR" || status === "PARTIALLY_COLLECTED") && (
          <button
            type="button"
            onClick={() => setShowCollectModal(true)}
            disabled={loadingAction !== null}
            className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
          >
            <Banknote size={12} />
            {loadingAction === "COLLECT"
              ? (locale === "en" ? "Saving..." : "جاري الحفظ...")
              : (locale === "en" ? "Record collection" : "تسجيل التحصيل")}
          </button>
        )}

        {/* شؤون إدارية: تأكيد تنفيذ الخدمة */}
        {canAdmin && status === "COLLECTED" && (
          <button
            type="button"
            onClick={() => runAction("CONFIRM_EXECUTION")}
            disabled={loadingAction !== null}
            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            <CheckCircle size={12} />
            {loadingAction === "CONFIRM_EXECUTION"
              ? (locale === "en" ? "Confirming..." : "جاري التأكيد...")
              : (locale === "en" ? "Confirm execution" : "تأكيد التنفيذ")}
          </button>
        )}

        {/* إلغاء — متاح للأدمن والمحاسب في أي حالة غير نهائية */}
        {(canAdmin || canCollect) && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(locale === "en" ? "Cancel this claim?" : "إلغاء هذه المطالبة؟")) return;
              runAction("CANCEL");
            }}
            disabled={loadingAction !== null}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={12} />
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </>
  );
}
