"use client";
import Link from "next/link";
import { useLocale } from "@/components/providers/locale-provider";
import { PayablesPanel } from "@/components/grocery/payables-panel";
export default function GroceryPortalPayablesPage() { const { locale } = useLocale(); return <main className="min-h-screen bg-slate-50 p-4 sm:p-8"><section className="mx-auto max-w-3xl space-y-5"><header className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white"><div><h1 className="text-2xl font-bold">{locale === "en" ? "Supplier credit invoices" : "فواتير الموردين الآجلة"}</h1><p className="mt-1 text-sm text-slate-300">{locale === "en" ? "Record invoices and supplier collections" : "تسجيل الفواتير وإثبات سداد المندوب"}</p></div><Link href="/grocery-portal" className="rounded-xl bg-white/10 px-4 py-2">{locale === "en" ? "Back" : "رجوع"}</Link></header><PayablesPanel endpoint="/api/grocery-portal/payables" locale={locale}/></section></main>; }
