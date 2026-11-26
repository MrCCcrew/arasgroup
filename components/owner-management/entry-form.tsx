"use client";
import { financePrimary, financeOutline } from "@/components/finance/workspace";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OwnerEntryForm({ companyId, type, partners }: { companyId: string; type: "revenue" | "expense"; partners: { id: string; name: string; mid: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = kind === "receipt" ? "سند قبض" : kind === "payment" ? "سند صرف" : type === "revenue" ? "إضافة إيراد" : "إضافة مصروف";
  return <div className="flex flex-wrap gap-2">
    <button className={financePrimary} onClick={() => { setError(""); setKind(type); }}>{type === "revenue" ? "إضافة إيراد" : "إضافة مصروف"}</button>
    <button className={financeOutline} onClick={() => { setError(""); setKind(type === "revenue" ? "receipt" : "payment"); }}>{type === "revenue" ? "إنشاء سند قبض" : "إنشاء سند صرف"}</button>
    {kind && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4"><form role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md space-y-4 rounded-lg bg-background p-5 shadow-xl" onSubmit={async event => {
      event.preventDefault(); if (saving) return;
      const form = new FormData(event.currentTarget); setSaving(true); setError("");
      try {
        const response = await fetch(`/api/owner-management/companies/${companyId}/entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, partnerId: form.get("partnerId"), date: form.get("date"), amount: Number(form.get("amount")), notes: form.get("notes") }) });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "تعذر الحفظ");
        const voucher = kind === "receipt" || kind === "payment";
        setKind(null);
        if (voucher) router.push(`/dashboard/companies/${companyId}/owner-management/vouchers/${body.data.id}?type=${body.data.type}`);
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ"); } finally { setSaving(false); }
    }}>
      <h2 className="text-lg font-bold">{title}</h2>
      <label className="block">الشريك<select name="partnerId" required defaultValue="" className="input-field mt-1"><option value="" disabled>اختر الشريك</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name} — {partner.mid}</option>)}</select></label>
      {!partners.length && <p className="text-sm text-destructive">أضف شريكًا نشطًا أولًا من قسم الشركاء.</p>}
      <label className="block">التاريخ<input name="date" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")} className="input-field mt-1" /></label>
      <label className="block">المبلغ (د.ك)<input name="amount" type="number" required min="0.001" max="100000000" step="0.001" className="input-field mt-1" /></label>
      <label className="block">البيان / ملاحظات<textarea name="notes" maxLength={4000} rows={3} className="input-field mt-1" /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2"><button disabled={saving || !partners.length} className={financePrimary}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button><button type="button" disabled={saving} className={financeOutline} onClick={() => setKind(null)}>إلغاء</button></div>
    </form></div>}
  </div>;
}
