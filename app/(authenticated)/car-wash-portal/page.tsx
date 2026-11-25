import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { redirect } from "next/navigation";
import { ChevronLeft, History, Receipt, Wallet } from "lucide-react";
import { getUiStyle } from "@/lib/ui-style";
import { getLocale } from "@/lib/i18n";

export default async function CarWashPortalPage() {
  const session = await getSession();
  if (!session) redirect("/login?portal=car-wash&expired=1");
  const context = await getCarWashPortalContext(session);
  if (!context) redirect("/dashboard");
  if ((await getUiStyle()) === "modern") {
    const en = (await getLocale()) === "en";
    const companyName = en ? context.company.nameEn ?? context.company.nameAr : context.company.nameAr;
    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-[24px] bg-[#0E6B73] p-5 text-white">
          <p className="text-sm text-white/75">{companyName}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{en ? "Daily operations" : "العمليات اليومية"}</h1>
          <p className="mt-1 text-sm text-white/80">{en ? "Record today's expenses and revenues" : "سجّل مصروفات وإيرادات اليوم"}</p>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/car-wash-portal/expenses" className="flex min-h-[132px] flex-col justify-between rounded-[22px] border border-[#E4E8F0] bg-white p-4 hover:bg-[#F8FAFC]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FEF1EC] text-[#B42318]"><Receipt className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold text-[#0F172A]">{en ? "Record expense" : "تسجيل مصروف"}</span>
          </Link>
          <Link href="/car-wash-portal/revenues" className="flex min-h-[132px] flex-col justify-between rounded-[22px] border border-[#E4E8F0] bg-white p-4 hover:bg-[#F8FAFC]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#ECFDF3] text-[#067647]"><Wallet className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold text-[#0F172A]">{en ? "Record revenue" : "تسجيل إيراد"}</span>
          </Link>
        </div>
        <Link href="/car-wash-portal/history" className="flex min-h-[72px] items-center gap-4 rounded-[22px] border border-[#E4E8F0] bg-white p-4 hover:bg-[#F8FAFC]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#EEF2FF] text-[#3B5BDB]"><History className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold text-[#0F172A]">{en ? "View history" : "سجل الحركات"}</span>
            <span className="block text-sm text-[#5B6577]">{en ? "Everything you recorded, with images" : "كل ما سجلته مع الصور"}</span>
          </span>
          <ChevronLeft className="h-5 w-5 shrink-0 text-[#94A3B8] ltr:rotate-180" />
        </Link>
      </div>
    );
  }
  return <div className="space-y-4"><section className="rounded-xl bg-cyan-700 p-5 text-white"><p className="text-sm opacity-80">{context.company.nameEn ?? context.company.nameAr}</p><h1 className="text-2xl font-bold">Daily operations</h1></section><div className="grid gap-3"><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/expenses">Record expense</Link><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/revenues">Record revenue</Link><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/history">View history</Link></div></div>;
}
