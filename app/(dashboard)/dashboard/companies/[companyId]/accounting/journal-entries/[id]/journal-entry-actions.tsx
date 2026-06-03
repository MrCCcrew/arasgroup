"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle, RotateCcw, Send, Trash2, Undo2, XCircle, ArrowLeftRight } from "lucide-react";

interface AvailableActions {
  submit: boolean;
  approve: boolean;
  reject: boolean;
  post: boolean;
  revert: boolean;
  cancel: boolean;
  delete: boolean;
  reverse: boolean;
}

interface Props {
  entryId: string;
  companyId: string;
  isLocked: boolean;
  availableActions: AvailableActions;
  locale?: "ar" | "en";
}

type ActionName = "submit" | "approve" | "reject" | "post" | "revert" | "cancel" | "delete" | "reverse";

const ACTION_CONFIG: Record<
  Exclude<ActionName, "delete" | "reverse">,
  { label: { ar: string; en: string }; loadingLabel: { ar: string; en: string }; className: string; icon: typeof Send }
> = {
  submit: {
    label: { ar: "إرسال للموافقة", en: "Submit for approval" },
    loadingLabel: { ar: "جارٍ الإرسال...", en: "Submitting..." },
    className: "bg-amber-600 hover:bg-amber-700 text-white",
    icon: Send,
  },
  approve: {
    label: { ar: "اعتماد", en: "Approve" },
    loadingLabel: { ar: "جارٍ الاعتماد...", en: "Approving..." },
    className: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: CheckCircle,
  },
  reject: {
    label: { ar: "رفض", en: "Reject" },
    loadingLabel: { ar: "جارٍ الرفض...", en: "Rejecting..." },
    className: "bg-rose-600 hover:bg-rose-700 text-white",
    icon: XCircle,
  },
  post: {
    label: { ar: "ترحيل", en: "Post" },
    loadingLabel: { ar: "جارٍ الترحيل...", en: "Posting..." },
    className: "bg-green-600 hover:bg-green-700 text-white",
    icon: Send,
  },
  revert: {
    label: { ar: "إرجاع لمسودة", en: "Revert to draft" },
    loadingLabel: { ar: "جارٍ الإرجاع...", en: "Reverting..." },
    className: "border border-border hover:bg-muted text-foreground",
    icon: Undo2,
  },
  cancel: {
    label: { ar: "إلغاء القيد", en: "Cancel entry" },
    loadingLabel: { ar: "جارٍ الإلغاء...", en: "Cancelling..." },
    className: "border border-orange-200 hover:bg-orange-50 text-orange-700",
    icon: Ban,
  },
};

export function JournalEntryActions({ entryId, companyId, isLocked, availableActions, locale = "ar" }: Props) {
  const router = useRouter();
  const en = locale === "en";
  const tr = {
    deleteFailed: en ? "Delete failed" : "فشل في الحذف",
    actionFailed: en ? "Failed to perform the action" : "فشل في تنفيذ الإجراء",
    yearLocked: en ? "Year locked" : "السنة مقفلة",
    confirmDelete: en ? "Delete this entry?" : "هل تريد حذف هذا القيد؟",
    confirmReverse: en ? "Are you sure you want to reverse this entry? A reversal entry will be created and this action cannot be undone." : "هل أنت متأكد من عكس هذا القيد؟ سيتم إنشاء قيد عكسي ولا يمكن التراجع عن العملية.",
    reversing: en ? "Reversing..." : "جارٍ العكس...",
    reverse: en ? "Reverse Entry" : "عكس القيد",
    deleting: en ? "Deleting..." : "جارٍ الحذف...",
    delete: en ? "Delete" : "حذف",
    reversalSuccess: en ? "Entry reversed successfully" : "تم عكس القيد بنجاح",
  };
  const [loading, setLoading] = useState<ActionName | null>(null);
  const [error, setError] = useState("");

  async function doAction(action: ActionName) {
    setError("");
    setLoading(action);

    try {
      if (action === "delete") {
        const response = await fetch(`/api/accounting/journal-entries/${entryId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? tr.deleteFailed);
        router.push(`/dashboard/companies/${companyId}/accounting/journal-entries`);
        return;
      }

      if (action === "reverse") {
        const response = await fetch(`/api/accounting/journal-entries/${entryId}/reverse`, { method: "POST" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? tr.actionFailed);
        router.push(`/dashboard/companies/${companyId}/accounting/journal-entries/${payload.data.id}`);
        return;
      }

      const response = await fetch(`/api/accounting/journal-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? tr.actionFailed);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : tr.actionFailed);
    } finally {
      setLoading(null);
    }
  }

  if (isLocked) {
    return <span className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">{tr.yearLocked}</span>;
  }

  const visibleActions = (Object.keys(availableActions) as ActionName[]).filter((action) => availableActions[action]);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}

      {visibleActions.map((action) => {
        if (action === "delete") {
          return (
            <button
              key={action}
              type="button"
              disabled={loading !== null}
              onClick={() => {
                if (confirm(tr.confirmDelete)) doAction("delete");
              }}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {loading === "delete" ? tr.deleting : tr.delete}
            </button>
          );
        }

        if (action === "reverse") {
          return (
            <button
              key={action}
              type="button"
              disabled={loading !== null}
              onClick={() => {
                if (confirm(tr.confirmReverse)) doAction("reverse");
              }}
              className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              <ArrowLeftRight size={15} />
              {loading === "reverse" ? tr.reversing : tr.reverse}
            </button>
          );
        }

        const config = ACTION_CONFIG[action];
        const Icon = config.icon;

        return (
          <button
            key={action}
            type="button"
            disabled={loading !== null}
            onClick={() => doAction(action)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50 ${config.className}`}
          >
            {action === "revert" ? <RotateCcw size={15} /> : <Icon size={15} />}
            {loading === action ? config.loadingLabel[locale] : config.label[locale]}
          </button>
        );
      })}
    </div>
  );
}
