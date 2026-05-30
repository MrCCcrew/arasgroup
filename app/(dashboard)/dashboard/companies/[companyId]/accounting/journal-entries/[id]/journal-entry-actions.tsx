"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle, RotateCcw, Send, Trash2, Undo2, XCircle } from "lucide-react";

interface AvailableActions {
  submit: boolean;
  approve: boolean;
  reject: boolean;
  post: boolean;
  revert: boolean;
  cancel: boolean;
  delete: boolean;
}

interface Props {
  entryId: string;
  companyId: string;
  isLocked: boolean;
  availableActions: AvailableActions;
}

type ActionName = "submit" | "approve" | "reject" | "post" | "revert" | "cancel" | "delete";

const ACTION_CONFIG: Record<
  Exclude<ActionName, "delete">,
  { label: string; loadingLabel: string; className: string; icon: typeof Send }
> = {
  submit: {
    label: "إرسال للموافقة",
    loadingLabel: "جارٍ الإرسال...",
    className: "bg-amber-600 hover:bg-amber-700 text-white",
    icon: Send,
  },
  approve: {
    label: "اعتماد",
    loadingLabel: "جارٍ الاعتماد...",
    className: "bg-blue-600 hover:bg-blue-700 text-white",
    icon: CheckCircle,
  },
  reject: {
    label: "رفض",
    loadingLabel: "جارٍ الرفض...",
    className: "bg-rose-600 hover:bg-rose-700 text-white",
    icon: XCircle,
  },
  post: {
    label: "ترحيل",
    loadingLabel: "جارٍ الترحيل...",
    className: "bg-green-600 hover:bg-green-700 text-white",
    icon: Send,
  },
  revert: {
    label: "إرجاع لمسودة",
    loadingLabel: "جارٍ الإرجاع...",
    className: "border border-border hover:bg-muted text-foreground",
    icon: Undo2,
  },
  cancel: {
    label: "إلغاء القيد",
    loadingLabel: "جارٍ الإلغاء...",
    className: "border border-orange-200 hover:bg-orange-50 text-orange-700",
    icon: Ban,
  },
};

export function JournalEntryActions({ entryId, companyId, isLocked, availableActions }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<ActionName | null>(null);
  const [error, setError] = useState("");

  async function doAction(action: ActionName) {
    setError("");
    setLoading(action);

    try {
      if (action === "delete") {
        const response = await fetch(`/api/accounting/journal-entries/${entryId}`, { method: "DELETE" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "فشل في الحذف");
        router.push(`/dashboard/companies/${companyId}/accounting/journal-entries`);
        return;
      }

      const response = await fetch(`/api/accounting/journal-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "فشل في تنفيذ الإجراء");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "فشل في تنفيذ الإجراء");
    } finally {
      setLoading(null);
    }
  }

  if (isLocked) {
    return <span className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">السنة مقفلة</span>;
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
                if (confirm("هل تريد حذف هذا القيد؟")) doAction("delete");
              }}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {loading === "delete" ? "جارٍ الحذف..." : "حذف"}
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
            {loading === action ? config.loadingLabel : config.label}
          </button>
        );
      })}
    </div>
  );
}
