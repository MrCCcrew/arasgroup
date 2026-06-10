"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface AccountOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  isHeader: boolean;
  isActive: boolean;
}

export function MoveLineButton({
  entryId,
  lineId,
  companyId,
}: {
  entryId: string;
  lineId: string;
  companyId: string;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const en = locale === "en";
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [destId, setDestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openModal() {
    setOpen(true);
    setError("");
    setDestId("");
    if (accounts.length === 0) {
      const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`);
      const payload = await res.json();
      if (payload.success) setAccounts(payload.data);
    }
  }

  async function handleMove() {
    if (!destId) {
      setError(en ? "Select a destination account" : "اختر حساب الوجهة");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounting/journal-entries/${entryId}/reclassify-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId, destinationAccountId: destId }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : en ? "Failed" : "فشل النقل");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={en ? "Move this line to another account" : "نقل هذا السطر لحساب آخر"}
      >
        <ArrowLeftRight size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{en ? "Move line to account" : "نقل السطر لحساب"}</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {en
                ? "Changes only this line's account (amount and debit/credit stay the same)."
                : "بيغيّر حساب هذا السطر فقط (المبلغ ومدين/دائن زي ما هما)."}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium">{en ? "Destination account *" : "حساب الوجهة *"}</label>
              <select value={destId} onChange={(e) => setDestId(e.target.value)} className="input-field w-full text-sm">
                <option value="">{en ? "Select..." : "اختر..."}</option>
                {accounts
                  .filter((a) => !a.isHeader && a.isActive)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {en ? a.nameEn ?? a.nameAr : a.nameAr}
                    </option>
                  ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleMove}
                disabled={loading || !destId}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check size={15} />
                {loading ? (en ? "Moving..." : "جارٍ النقل...") : en ? "Move" : "نقل"}
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                {en ? "Cancel" : "إلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
