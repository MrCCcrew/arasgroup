"use client";
import Link from "next/link"; import { useEffect, useState } from "react"; import { CheckCircle, Clock, FileText, MapPin, XCircle } from "lucide-react"; import { Button } from "@/components/ui/button"; import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; import { useLocale } from "@/components/providers/locale-provider";
import { Camera, ChevronLeft, Landmark } from "lucide-react";
import { useUiStyle } from "@/components/providers/ui-style-provider";
import { useDriverTracking } from "@/components/driver/tracking-provider";
import { formatCurrency } from "@/lib/utils/currency";
type Invoice = { reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED" };
type RecentInvoice = Invoice & { id: string; invoiceDate: string; amount: number; currency: string; imagePath: string };
export default function DriverHomePage() { const { t } = useLocale(); const { isModern } = useUiStyle(); const [recent, setRecent] = useState<RecentInvoice[]>([]); const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 }); useEffect(() => { fetch("/api/driver/invoices").then((r) => r.json()).then((data: { success?: boolean; data?: Invoice[] }) => { const invoices = data.success ? data.data ?? [] : []; setRecent((invoices as RecentInvoice[]).slice(0, 3)); setStats({ pending: invoices.filter((item) => item.reviewStatus === "PENDING_REVIEW").length, approved: invoices.filter((item) => item.reviewStatus === "APPROVED").length, rejected: invoices.filter((item) => item.reviewStatus === "REJECTED").length }); }).catch(() => undefined); }, []); if (isModern) return <ModernDriverHome stats={stats} recent={recent} />; const cards = [{ icon: Clock, key: "pendingReview", value: stats.pending, color: "text-yellow-600" }, { icon: CheckCircle, key: "approved", value: stats.approved, color: "text-green-600" }, { icon: XCircle, key: "rejected", value: stats.rejected, color: "text-red-600" }] as const; return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">{t("driver.welcome")}</h1><div className="grid gap-4">{cards.map(({ icon: Icon, key, value, color }) => <Card key={key}><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Icon className={`h-4 w-4 ${color}`} />{t(`driver.${key}`)}</CardTitle></CardHeader><CardContent><div className={`text-3xl font-bold ${color}`}>{value}</div></CardContent></Card>)}</div><div className="grid gap-3"><Link href="/driver/invoices/upload"><Button className="h-14 w-full"><FileText className="ms-2 h-5 w-5" />{t("driver.uploadInvoice")}</Button></Link><Link href="/driver/invoices"><Button variant="outline" className="h-14 w-full"><FileText className="ms-2 h-5 w-5" />{t("driver.viewInvoices")}</Button></Link><Link href="/driver/tracking"><Button variant="outline" className="h-14 w-full"><MapPin className="ms-2 h-5 w-5" />{t("driver.startTracking")}</Button></Link></div></div>; }

// Modern style only — same data as the classic view (invoice counts + the same invoice list), display only.
function ModernDriverHome({ stats, recent }: { stats: { pending: number; approved: number; rejected: number }; recent: RecentInvoice[] }) {
  const { t, locale } = useLocale();
  const en = locale === "en";
  const { tracking, locationCount } = useDriverTracking();
  const date = (value: string) => new Date(value).toLocaleDateString(en ? "en-US" : "ar-KW");
  const statusChip = { PENDING_REVIEW: "bg-[#FFF6E0] text-[#8A5A00]", APPROVED: "bg-[#ECFDF3] text-[#067647]", REJECTED: "bg-[#FEF1EC] text-[#B42318]" } as const;
  const statusKey = { PENDING_REVIEW: "pendingReview", APPROVED: "approved", REJECTED: "rejected" } as const;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-[#0F172A]">{t("driver.welcome")}</h1>

      <section className="flex items-center justify-between gap-3 rounded-[24px] bg-[#0F172A] p-5 text-white">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <span className={`h-2.5 w-2.5 rounded-full ${tracking ? "bg-[#22C55E]" : "bg-slate-500"}`} />
            {tracking ? t("driver.trackingActive") : t("driver.inactive")}
          </p>
          {tracking ? (
            <>
              <p className="mt-2 text-xs text-slate-400">{t("driver.pointsSent")}</p>
              <p className="text-3xl font-extrabold">{locationCount}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">{t("driver.trackingStatus")}</p>
          )}
        </div>
        <Link href="/driver/tracking" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] bg-white/10 px-4 text-sm font-bold hover:bg-white/15">
          <MapPin className="h-4 w-4" />
          {tracking ? t("driver.tracking") : t("driver.startTracking")}
        </Link>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {([
          ["pendingReview", stats.pending, "bg-[#FFF6E0] text-[#8A5A00]"],
          ["approved", stats.approved, "bg-[#ECFDF3] text-[#067647]"],
          ["rejected", stats.rejected, "bg-[#FEF1EC] text-[#B42318]"],
        ] as const).map(([key, value, tone]) => (
          <div key={key} className={`rounded-[18px] p-3 ${tone}`}>
            <p className="text-xs font-bold">{t(`driver.${key}`)}</p>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      <Link href="/driver/invoices/upload" className="flex min-h-[76px] items-center gap-4 rounded-[22px] bg-[#3B5BDB] p-4 text-white hover:bg-[#3350C8]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/15"><Camera className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{t("driver.uploadInvoice")}</span>
          <span className="block text-sm text-white/80">{t("driver.uploadInvoiceDescription")}</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0 ltr:rotate-180" />
      </Link>

      <Link href="/driver/deposits" className="flex min-h-[72px] items-center gap-4 rounded-[22px] border border-[#E4E8F0] bg-white p-4 hover:bg-[#F8FAFC]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#ECFDF3] text-[#067647]"><Landmark className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold text-[#0F172A]">{en ? "Upload deposit receipt" : "رفع إيصال إيداع"}</span>
          <span className="block text-sm text-[#5B6577]">{en ? "Counted after administration approval" : "يُحتسب بعد موافقة الإدارة"}</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0 text-[#94A3B8] ltr:rotate-180" />
      </Link>

      <section className="rounded-[22px] border border-[#E4E8F0] bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{t("driver.recentInvoices")}</h2>
          <Link href="/driver/invoices" className="text-sm font-bold text-[#3B5BDB]">{t("driver.viewInvoices")}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#5B6577]">{t("driver.noInvoices")}</p>
        ) : (
          <div className="divide-y divide-[#EEF0F4]">
            {recent.map((invoice) => (
              <div key={invoice.id} className="flex items-center gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={invoice.imagePath} alt={t("driver.invoiceImage")} className="h-12 w-12 shrink-0 rounded-[12px] bg-[#F1F4F9] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{formatCurrency(invoice.amount, invoice.currency)}</p>
                  <p className="text-xs text-[#5B6577]">{date(invoice.invoiceDate)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusChip[invoice.reviewStatus]}`}>{t(`driver.${statusKey[invoice.reviewStatus]}`)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
