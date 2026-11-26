"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { defaultVoucherPrintSettings, type VoucherPrintSettings } from "@/lib/accounting/voucher-print-settings";

export default function VoucherPrintSettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const en = useLocale().locale === "en";
  const [settings, setSettings] = useState<VoucherPrintSettings>(defaultVoucherPrintSettings);
  const [ready, setReady] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReady(false); setError(""); setMessage("");
    fetch(`/api/companies/${companyId}/voucher-print-settings`).then(async r => {
      const body = await r.json();
      if (!r.ok || !body.success) throw new Error(body.error || "Failed to load settings");
      if (active) { setSettings(body.data); setCanEdit(body.canEdit); setReady(true); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [companyId]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const r = await fetch(`/api/companies/${companyId}/voucher-print-settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const body = await r.json();
      if (!r.ok || !body.success) throw new Error(body.error || "Failed to save settings");
      setMessage(en ? "Saved for this company." : "تم حفظ الإعدادات لهذه الشركة فقط.");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save settings"); }
    finally { setSaving(false); }
  }
  return <div>
    <Header title={en ? "Voucher print settings" : "إعدادات طباعة السندات"} companyId={companyId} subtitle={en ? "Payment and receipt vouchers for this company only" : "سندات الصرف والقبض لهذه الشركة فقط"} />
    <div className="page-container max-w-2xl space-y-4">
      <div className="flex gap-4"><Link href={`/dashboard/companies/${companyId}/accounting/receipts`}>{en ? "Receipts" : "سندات القبض"}</Link><Link href={`/dashboard/companies/${companyId}/accounting/payments`}>{en ? "Payments" : "سندات الصرف"}</Link></div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {message && <p role="status" className="text-green-700">{message}</p>}
      {!ready && !error && <p>{en ? "Loading…" : "جار التحميل..."}</p>}
      {ready && <form onSubmit={save} className="section-card space-y-5">
        <fieldset disabled={!canEdit || saving} className="space-y-5">
          <div><label htmlFor="copies" className="form-label">{en ? "Copies" : "عدد النسخ"}</label><select id="copies" className="input-field" value={settings.copies} onChange={e => { setSettings({ ...settings, copies: Number(e.target.value) as 1 | 2 }); setMessage(""); }}><option value={1}>{en ? "One copy on one sheet" : "نسخة واحدة في ورقة واحدة"}</option><option value={2}>{en ? "Two copies (original and copy)" : "نسختان (أصل وصورة)"}</option></select></div>
          <div><label htmlFor="orientation" className="form-label">{en ? "Paper orientation" : "اتجاه الورقة"}</label><select id="orientation" className="input-field" value={settings.orientation} onChange={e => { setSettings({ ...settings, orientation: e.target.value as VoucherPrintSettings["orientation"] }); setMessage(""); }}><option value="portrait">{en ? "Portrait" : "بالطول"}</option><option value="landscape">{en ? "Landscape" : "بالعرض"}</option></select></div>
          <p className="text-sm text-muted-foreground">{en ? "A4. Applied to both payment and receipt vouchers when opening print preview." : "ورق A4. تُطبّق على سندات الصرف والقبض عند فتح معاينة الطباعة."}</p>
          {canEdit && <button className="btn-primary" type="submit">{saving ? (en ? "Saving…" : "جار الحفظ...") : (en ? "Save settings" : "حفظ الإعدادات")}</button>}
        </fieldset>
        {!canEdit && <p>{en ? "You have view-only access." : "صلاحيتك تسمح بعرض الإعدادات فقط."}</p>}
      </form>}
    </div>
  </div>;
}
