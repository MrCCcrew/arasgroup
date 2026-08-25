"use client";

import { LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";

export function PartnerProfileMenu({ name, mid }: { name?: string; mid?: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const en = locale === "en";
  const text = (ar: string, english: string) => (en ? english : ar);
  async function logout() { setLoggingOut(true); try { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); } finally { setLoggingOut(false); } }
  return <div className="relative"><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm"><UserCircle size={19} /><span className="sm:hidden">{text("حسابي", "Profile")}</span></button>{open && <div className="absolute end-0 top-full z-30 mt-2 w-56 rounded-lg border bg-background p-3 shadow-lg"><p className="truncate font-semibold">{name || text("حساب الشريك", "Partner account")}</p>{mid && <p className="mt-1 text-xs text-muted-foreground" dir="ltr">MID: {mid}</p>}<button type="button" onClick={() => void logout()} disabled={loggingOut} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"><LogOut size={17} />{loggingOut ? text("جارٍ تسجيل الخروج...", "Signing out...") : text("تسجيل الخروج", "Sign out")}</button></div>}</div>;
}
