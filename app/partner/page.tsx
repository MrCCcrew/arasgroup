"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PartnerProfileMenu } from "@/components/partner/partner-profile-menu";
import { useLocale } from "@/components/providers/locale-provider";

type Summary = { partner: { name: string; mid: string }; revenue: number; expense: number; net: number };

export default function PartnerPortal() {
  const { locale } = useLocale();
  const en = locale === "en";
  const text = (ar: string, english: string) => (en ? english : ar);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/owner-management/partner/summary", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
      setSummary(payload.data);
    } catch { setError(text("تعذر تحديث الملخص. حاول مرة أخرى.", "Unable to refresh the summary. Please try again.")); }
    finally { setLoading(false); }
  }, [en]);
  useEffect(() => { void refresh(); }, [refresh]);
  const cards = summary ? [[text("الإيرادات", "Revenues"), summary.revenue], [text("المصروفات", "Expenses"), summary.expense], [text("صافي الحساب", "Net balance"), summary.net]] : [];
  return <main dir={en ? "ltr" : "rtl"} className="min-h-screen bg-muted/30 p-4 md:p-8"><section className="mx-auto max-w-4xl space-y-6"><header className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{text("بوابة الشريك", "Partner portal")}</h1>{summary && <p className="text-sm text-muted-foreground">{summary.partner.name} · MID: <span dir="ltr">{summary.partner.mid}</span></p>}</div><div className="flex items-center gap-2"><PartnerProfileMenu name={summary?.partner.name} mid={summary?.partner.mid} /><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">{text("تحديث الملخص", "Refresh summary")}</span></button></div></header>{error && <p className="rounded border border-destructive p-3 text-sm text-destructive">{error}</p>}<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{loading ? [0, 1, 2].map((key) => <div key={key} className="section-card h-24 animate-pulse" />) : cards.map(([title, value]) => <div key={String(title)} className="section-card"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold" dir="ltr">{Number(value).toFixed(3)} KWD</p></div>)}</div><div className="section-card grid grid-cols-1 gap-3 sm:grid-cols-3"><Link className="rounded-lg border p-4 text-center" href="/partner/expenses">{text("رفع ومراجعة المصروفات", "Upload and review expenses")}</Link><Link className="rounded-lg border p-4 text-center" href="/partner/revenues">{text("إيراداتي وإيصالات الإيداع", "Revenues and deposit receipts")}</Link><Link className="rounded-lg border p-4 text-center" href="/partner/statement">{text("كشف حسابي", "My statement")}</Link></div></section></main>;
}
