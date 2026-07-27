"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";

export function OwnerManagementBreadcrumb({ companyId, companyNameAr, companyNameEn }: { companyId: string; companyNameAr: string; companyNameEn: string | null }) {
  const { locale } = useLocale(); const english = locale === "en";
  const name = english ? companyNameEn ?? companyNameAr : companyNameAr;
  const pathname = usePathname();
  const leaf = pathname.endsWith("/partners") ? (english ? "Partners" : "الشركاء") : pathname.endsWith("/expenses") ? (english ? "Expenses" : "المصروفات") : pathname.endsWith("/revenues") ? (english ? "Revenues" : "الإيرادات") : pathname.endsWith("/imports") ? (english ? "Import history" : "سجل الاستيراد") : pathname.endsWith("/import") ? (english ? "Upload statement" : "رفع كشف حساب") : (english ? "Dashboard" : "لوحة التحكم");
  return <nav className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground" dir={english ? "ltr" : "rtl"}><Link className="hover:text-foreground" href="/dashboard">{english ? "Group" : "المجموعة"}</Link><span>›</span><Link className="hover:text-foreground" href={`/dashboard/companies/${companyId}`}>{name}</Link><span>›</span><Link className="hover:text-foreground" href={`/dashboard/companies/${companyId}/owner-management`}>{english ? "Owner management" : "إدارة المالك"}</Link><span>›</span><span>{leaf}</span></nav>;
}
