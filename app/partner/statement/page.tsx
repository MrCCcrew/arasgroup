"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
type Summary = { partner: { name: string; mid: string }; revenue: number; expense: number; net: number };
export default function PartnerStatementPage() {
  const { locale } = useLocale(); const en = locale === "en"; const t = (ar: string, english: string) => en ? english : ar;
  const [data, setData] = useState<Summary | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const response = await fetch("/api/owner-management/partner/summary", { cache: "no-store" }); const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(); setData(payload.data); } catch { setError(t("تعذر تحميل كشف الحساب.", "Unable to load the statement.")); } }, [en]); useEffect(() => { void load(); }, [load]);
  return <main dir={en ? "ltr" : "rtl"} className="min-h-screen bg-muted/30 p-4 md:p-8"><section className="mx-auto max-w-2xl space-y-6"><header><h1 className="text-2xl font-bold">{t("كشف حسابي", "My statement")}</h1>{data && <p className="text-muted-foreground">{data.partner.name} · MID: <span dir="ltr">{data.partner.mid}</span></p>}</header>{error ? <p className="rounded border border-destructive p-3 text-destructive">{error}</p> : <dl className="section-card grid gap-4 sm:grid-cols-3">{[[t("إجمالي الإيرادات", "Total revenues"), data?.revenue], [t("إجمالي المصروفات", "Total expenses"), data?.expense], [t("الصافي", "Net balance"), data?.net]].map(([label, amount]) => <div key={String(label)}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-xl font-bold" dir="ltr">{data ? `${Number(amount).toFixed(3)} KWD` : "…"}</dd></div>)}</dl>}<Link className="text-primary underline" href="/partner">{t("العودة للبوابة", "Back to portal")}</Link></section></main>;
}
