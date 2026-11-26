"use client";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { PayablesPanel } from "@/components/grocery/payables-panel";
export default function GroceryPayablesPage() { const { companyId } = useParams<{ companyId: string }>(); const { locale } = useLocale(); return <div className="finance-workspace"><Header companyId={companyId} title={locale === "en" ? "Supplier credit invoices" : "فواتير الموردين الآجلة"} subtitle={locale === "en" ? "Opening-inventory and new credit purchases" : "فواتير قديمة ضمن أول المدة وفواتير شراء آجل جديدة"}/><main className="page-container max-w-5xl"><PayablesPanel endpoint={`/api/companies/${companyId}/grocery/payables`} locale={locale}/></main></div>; }
