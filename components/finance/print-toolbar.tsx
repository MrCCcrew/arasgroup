"use client";

import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { financeOutline, financePrimary } from "./workspace";

export function FinancePrintToolbar({ backHref, en = false }: { backHref: string; en?: boolean }) {
  return <div className="no-print mb-6 flex flex-wrap gap-2"><button className={financePrimary} onClick={() => window.print()}><Printer size={16} />{en ? "Print / PDF" : "طباعة / PDF"}</button><Link className={financeOutline} href={backHref}><ArrowRight size={16} />{en ? "Back" : "العودة"}</Link></div>;
}
