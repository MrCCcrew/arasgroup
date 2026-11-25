import Link from "next/link";
import { AlertTriangle, Building2, CalendarDays, ChevronLeft, Search, Sparkles, Users, Zap } from "lucide-react";
import { Header } from "@/components/layout/header";
import type { AlertItem, ExpiryAlertTotals } from "../ExpiryAlertsPanel";
import { ModernExpiryAlerts } from "./ModernExpiryAlerts";
import { CompanyAvatar, ModernCompanies, type ModernCompanyRow } from "./ModernCompanies";
import { companyTypeLabel } from "@/components/modern/company-meta";

interface Props {
  userName: string;
  companies: ModernCompanyRow[];
  totalEmployees: number;
  expiringResidencies: number;
  alerts: { alerts: AlertItem[]; totals: ExpiryAlertTotals } | null;
  showDeleted: boolean;
  quickLinks: { href: string; label: string }[];
}

function greeting(hour: number) {
  return hour < 12 ? "صباح الخير" : "مساء الخير";
}

/** Modern layout of the group dashboard. Uses exactly the data the classic page already loads. */
export function ModernGroupDashboard({ userName, companies, totalEmployees, expiringResidencies, alerts, showDeleted, quickLinks }: Props) {
  const now = new Date();
  const kuwaitHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kuwait" }).format(now));
  const dateLabel = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuwait" }).format(now);
  const year = now.getFullYear();
  const yearEnd = new Date(year, 11, 31);
  const yearStart = new Date(year, 0, 1);
  const daysLeft = Math.max(0, Math.ceil((yearEnd.getTime() - now.getTime()) / 86400000));
  const yearProgress = Math.round(((now.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())) * 100);

  const byEmployees = [...companies].sort((a, b) => b.total - a.total);
  const top = byEmployees.slice(0, 4);
  const restTotal = Math.max(0, totalEmployees - top.reduce((s, c) => s + c.total, 0));
  const topShare = totalEmployees > 0 && top[0] ? Math.round((top[0].total / totalEmployees) * 100) : 0;
  const maxCompany = Math.max(1, top[0]?.total ?? 1);

  const totals = alerts?.totals ?? { danger: 0, warning: 0, notice: 0 };
  const allAlerts = alerts?.alerts ?? [];
  const nearest = allAlerts[0];
  const alertCountByCompany = new Map<string, number>();
  for (const a of allAlerts) alertCountByCompany.set(a.companyName, (alertCountByCompany.get(a.companyName) ?? 0) + 1);
  const busiestCompany = [...alertCountByCompany.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sum = totals.danger + totals.warning + totals.notice;
  const pct = (n: number) => (sum ? `${(n / sum) * 100}%` : "0%");

  return (
    <div>
      <Header title={`${greeting(kuwaitHour)}، ${userName}`} subtitle={dateLabel} />
      <div className="page-container">
        <form action="/dashboard/search" className="flex flex-wrap gap-2" role="search">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-[#E4E8F0] bg-white px-4">
            <Search size={18} className="text-[#5B6577]" />
            <input name="q" placeholder="ابحث عن موظف، ترخيص، مسؤول أو رقم جوال…" aria-label="البحث العام" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
          </label>
          <button type="submit" className="h-12 rounded-2xl bg-[#3B5BDB] px-5 text-sm font-bold text-white">بحث</button>
        </form>

        {/* Today's summary — built only from the alerts already loaded on this page */}
        <section aria-label="ملخص اليوم" className="flex flex-wrap items-center gap-6 rounded-[24px] border border-[#E4E8F0] bg-card p-5 md:p-6">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EEF2FF] px-3 py-1 text-[13px] font-bold text-[#3730A3]">
              <Sparkles size={14} /> ملخص اليوم
            </span>
            {nearest ? (
              <p className="text-lg font-bold leading-[1.8] md:text-[21px]">
                لديك <span className="text-[#C4320A]">{totals.danger} {totals.danger === 1 ? "مستند حرج" : "مستندات حرجة"}</span> تنتهي خلال 30 يوماً،
                أقربها {nearest.expiryLabel} لـ«{nearest.entityLabel}» خلال <span className="whitespace-nowrap">{nearest.daysLeft} يوم</span>.
                {busiestCompany && <> أكثر التنبيهات في {busiestCompany}.</>}
              </p>
            ) : (
              <p className="text-lg font-bold leading-[1.8] md:text-[21px]">لا توجد مستندات تنتهي خلال الـ 90 يوماً القادمة.</p>
            )}
            <div className="flex flex-wrap gap-2.5">
              {quickLinks.map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex h-11 items-center rounded-[14px] border border-[#E4E8F0] bg-white px-4 text-sm font-bold text-[#0F172A] hover:bg-[#F8FAFC]">{l.label}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-[0_1_320px] flex-col gap-3.5 rounded-[18px] bg-[#F8FAFC] p-[18px]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">حالة المستندات</span>
              <span className="text-[13px] text-[#5B6577]">{sum} تنبيه</span>
            </div>
            <div className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-[#EEF0F4]">
              <span className="rounded-full bg-[#C4320A]" style={{ width: pct(totals.danger) }} />
              <span className="rounded-full bg-[#E8A317]" style={{ width: pct(totals.warning) }} />
              <span className="rounded-full bg-[#7FA7E8]" style={{ width: pct(totals.notice) }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="block text-2xl font-extrabold text-[#C4320A]">{totals.danger}</span><span className="text-[13px] text-[#5B6577]">حرجة</span></div>
              <div><span className="block text-2xl font-extrabold text-[#8A5A00]">{totals.warning}</span><span className="text-[13px] text-[#5B6577]">تحذير</span></div>
              <div><span className="block text-2xl font-extrabold text-[#1D5FA8]">{totals.notice}</span><span className="text-[13px] text-[#5B6577]">تنبيه</span></div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section aria-label="المؤشرات" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="flex flex-col gap-3.5 rounded-[22px] border border-[#E4E8F0] bg-card p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-[#5B6577]">إجمالي الشركات</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#3B5BDB]"><Building2 size={20} /></span></div>
            <span className="text-[40px] font-extrabold leading-none">{companies.length}</span>
          </div>
          <div className="flex flex-col gap-3.5 rounded-[22px] border border-[#E4E8F0] bg-card p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-[#5B6577]">إجمالي الموظفين</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#067647]"><Users size={20} /></span></div>
            <span className="text-[40px] font-extrabold leading-none">{totalEmployees}</span>
            {top[0] && <span className="text-[13px] text-[#5B6577]">{topShare}% منهم في {top[0].nameAr} ({top[0].total})</span>}
          </div>
          <div className="flex flex-col gap-3.5 rounded-[22px] border border-[#F5D78A] bg-[#FFFBEB] p-5">
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#8A5A00]">إقامات تنتهي قريباً</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF0C7] text-[#8A5A00]"><AlertTriangle size={20} /></span></div>
            <span className="text-[40px] font-extrabold leading-none text-[#6B4600]">{expiringResidencies}</span>
            <span className="text-[13px] text-[#8A5A00]">خلال 60 يوماً</span>
          </div>
          <div className="flex flex-col gap-3.5 rounded-[22px] border border-[#E4E8F0] bg-card p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-[#5B6577]">الفترة المالية</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F3FF] text-[#5925DC]"><CalendarDays size={20} /></span></div>
            <span className="text-[40px] font-extrabold leading-none">{year}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#EEF0F4]"><span className="block h-full rounded-full bg-[#7A5AF8]" style={{ width: `${yearProgress}%` }} /></span>
            <span className="text-[13px] text-[#5B6577]">متبقٍ {daysLeft} يوماً على إقفال السنة</span>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-[999_1_560px]">
            {alerts && alerts.alerts.length > 0 ? (
              <ModernExpiryAlerts alerts={alerts.alerts} totals={alerts.totals} />
            ) : (
              <section className="rounded-[24px] border border-[#E4E8F0] bg-card p-8 text-center text-sm text-[#5B6577]">لا توجد تنبيهات انتهاء حالياً</section>
            )}
          </div>
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
            <section aria-label="الوصول السريع" className="flex flex-col overflow-hidden rounded-[24px] border-2 border-[#C7D2FE] bg-[#F5F7FF] shadow-[0_8px_24px_rgba(59,91,219,0.12)]">
              <div className="flex items-center gap-3 bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] px-5 py-4 text-white">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/20"><Zap size={18} /></span>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold leading-tight">الوصول السريع</h2>
                  <p className="text-xs text-white/85">ادخل على أي شركة بضغطة · {companies.length} شركة</p>
                </div>
              </div>
              <div className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto p-3">
                {companies.map((c) => (
                  <Link key={c.id} href={`/dashboard/companies/${c.id}`} className="flex min-h-11 shrink-0 items-center gap-3 rounded-[14px] border border-[#E4E8F0] bg-white p-2.5 transition-colors hover:border-[#A5B4FC] hover:bg-[#EEF2FF]">
                    <CompanyAvatar company={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold" title={c.nameAr}>{c.nameAr}</span>
                      <span className="text-xs text-[#5B6577]">{companyTypeLabel(c.type)} · {c.total} موظف</span>
                    </span>
                    <ChevronLeft size={16} className="text-[#94A3B8]" />
                  </Link>
                ))}
              </div>
            </section>
            <section aria-label="الموظفون حسب الشركة" className="flex flex-col gap-3 rounded-[24px] border border-[#E4E8F0] bg-card p-5">
              <h2 className="text-lg font-extrabold">الموظفون حسب الشركة</h2>
              {[...top.map((c) => ({ name: c.nameAr, n: c.total })), ...(restTotal > 0 ? [{ name: `بقية الشركات (${Math.max(0, companies.length - top.length)})`, n: restTotal }] : [])].map((row) => (
                <div key={row.name} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2 text-[13px]"><span className="truncate">{row.name}</span><span className="font-bold">{row.n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EEF0F4]"><div className="h-full rounded-full bg-[#3B5BDB]" style={{ width: `${Math.min(100, Math.max(3, Math.round((row.n / maxCompany) * 100)))}%` }} /></div>
                </div>
              ))}
            </section>
          </aside>
        </div>

        <ModernCompanies companies={companies} showDeleted={showDeleted} />
      </div>
    </div>
  );
}
