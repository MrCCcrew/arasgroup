"use client";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function RevenueReceiptActions({ companyId, revenueId, amount, receiptImageUrl }: { companyId: string; revenueId: string; amount: number; receiptImageUrl: string | null }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [value, setValue] = useState(amount.toFixed(3)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function save() { if (!Number(value) || Number(value) <= 0) { setError("أدخل مبلغاً صحيحاً."); return; } setSaving(true); setError(""); try { const response = await fetch(`/api/owner-management/companies/${companyId}/revenues/${revenueId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(value) }) }); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "Save failed"); setEditing(false); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ."); } finally { setSaving(false); } }
  async function remove() {
    const reason = window.prompt("سبب حذف الإيراد (3 أحرف على الأقل):");
    if (reason === null) return;
    if (reason.trim().length < 3) { setError("أدخل سبب الحذف (3 أحرف على الأقل)."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/owner-management/companies/${companyId}/revenues/${revenueId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "تعذر الحذف");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحذف"); } finally { setSaving(false); }
  }
  return <div className="flex items-center gap-2">{receiptImageUrl && <a href={receiptImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Eye size={15} />عرض الإيصال</a>}<button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Pencil size={15} />تعديل المبلغ</button><button type="button" disabled={saving} onClick={() => void remove()} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 size={15} />حذف</button>{error && !editing && <p role="alert" className="text-sm text-destructive">{error}</p>}{editing && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-sm rounded-lg bg-background p-5 shadow-xl" dir="rtl"><h2 className="font-bold">تعديل مبلغ الإيراد</h2><input autoFocus type="number" min="0.001" step="0.001" value={value} onChange={(event) => setValue(event.target.value)} className="mt-3 w-full rounded border p-2" dir="ltr" />{error && <p className="mt-2 text-sm text-destructive">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted">إلغاء</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "جارٍ الحفظ…" : "حفظ"}</button></div></div></div>}</div>;
}
