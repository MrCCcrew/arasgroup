"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { companyId: string; expenseId: string; amount: number; invoiceDate: string; notes: string | null; imageUrl: string | null };

export function ExpenseActions({ companyId, expenseId, amount, invoiceDate, notes, imageUrl }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [value, setValue] = useState(amount.toFixed(3)); const [date, setDate] = useState(invoiceDate); const [note, setNote] = useState(notes ?? "");
  async function update() {
    if (!Number(value) || Number(value) <= 0) { setError("أدخل مبلغًا صحيحًا."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/owner-management/companies/${companyId}/expenses/${expenseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(value), invoiceDate: new Date(`${date}T00:00:00.000Z`).toISOString(), notes: note || null }) });
      const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "Save failed");
      setEditing(false); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ."); } finally { setSaving(false); }
  }
  async function remove() {
    if (!window.confirm("هل تريد حذف هذا المصروف؟")) return;
    setSaving(true);
    try { const response = await fetch(`/api/owner-management/companies/${companyId}/expenses/${expenseId}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "Delete failed"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحذف."); } finally { setSaving(false); }
  }
  return <><div className="flex flex-wrap items-center gap-2">{imageUrl && <a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Eye size={15} />عرض الصورة</a>}<button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Pencil size={15} />تعديل</button><button type="button" disabled={saving} onClick={() => void remove()} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 size={15} />حذف</button></div>{error && <p className="mt-1 text-xs text-destructive">{error}</p>}{editing && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl" dir="rtl"><h2 className="font-bold">تعديل المصروف</h2><div className="mt-3 grid gap-3"><label className="text-sm">التاريخ<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field mt-1" /></label><label className="text-sm">المبلغ<input type="number" min="0.001" step="0.001" value={value} onChange={(event) => setValue(event.target.value)} className="input-field mt-1" dir="ltr" /></label><label className="text-sm">ملاحظات<textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-field mt-1" rows={3} /></label></div>{error && <p className="mt-2 text-sm text-destructive">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted">إلغاء</button><button type="button" disabled={saving} onClick={() => void update()} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "جارٍ الحفظ…" : "حفظ"}</button></div></div></div>}</>;
}
