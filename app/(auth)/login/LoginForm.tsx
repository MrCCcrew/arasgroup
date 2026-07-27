"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale } from "@/components/providers/locale-provider";

interface Props {
  logoUrl: string | null;
  groupNameAr: string;
  groupNameEn: string | null;
  portal?: "car-wash" | "driver";
  expired?: boolean;
}

export default function LoginForm({ logoUrl, groupNameAr, groupNameEn, portal, expired = false }: Props) {
  const { locale } = useLocale();
  const english = locale === "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = (ar: string, en: string) => (english ? en : ar);
  const portalTitle = portal === "car-wash" ? t("\u0628\u0648\u0627\u0628\u0629 \u0645\u0648\u0638\u0641\u064A \u063A\u0633\u064A\u0644 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A", "Car Wash Staff Portal") : portal === "driver" ? t("\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0633\u0627\u0626\u0642", "Driver Portal") : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? t("\u062E\u0637\u0623 \u0641\u064A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", "Incorrect email or password"));
        return;
      }
      // The API determines the destination from the authenticated account type.
      window.location.assign(data.redirectTo ?? "/dashboard");
    } catch {
      setError(t("\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645", "Unable to connect to the server"));
    } finally {
      setLoading(false);
    }
  }

  return <div className="w-full max-w-md" dir={english ? "ltr" : "rtl"}>
    <div className="mb-8 text-center">
      <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
      {logoUrl ? <div className="relative mx-auto mb-5 overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.55)]" style={{ width: 300, height: 170 }}><Image src={logoUrl} alt={english ? (groupNameEn ?? groupNameAr) : groupNameAr} fill className="object-contain p-3" unoptimized /></div> : <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary shadow-lg"><span className="text-4xl font-bold text-primary-foreground">\u0631</span></div>}
      <h1 className="text-2xl font-bold text-white">{portalTitle ?? (english ? (groupNameEn ?? groupNameAr) : groupNameAr)}</h1>
      {portalTitle && <p className="mt-1 text-sm text-slate-300">{english ? (groupNameEn ?? groupNameAr) : groupNameAr}</p>}
      {groupNameEn && !english && !portalTitle && <p className="mt-1 text-sm text-slate-400" dir="ltr">{groupNameEn}</p>}
    </div>
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      <h2 className="mb-6 text-center text-xl font-bold text-slate-900">{t("\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", "Sign in")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {expired && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800" role="status">{t("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629. \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.", "Your session has expired. Please sign in again.")}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">{error}</div>}
        <div className="space-y-1"><label className="block text-sm font-medium text-slate-700">{t("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", "Email address")}</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@company.com" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary" dir="ltr" /></div>
        <div className="space-y-1"><label className="block text-sm font-medium text-slate-700">{t("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "Password")}</label><div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="w-full rounded-lg border border-slate-200 px-4 py-3 pe-12 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary" dir="ltr" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 left-0 flex items-center px-3 text-slate-500 hover:text-slate-700" aria-label={showPassword ? t("\u0625\u062E\u0641\u0627\u0621 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "Hide password") : t("\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "Show password")}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
        <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? t("\u062C\u0627\u0631\u064A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644...", "Signing in...") : t("\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", "Sign in")}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">{t("\u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u2014 \u0627\u0644\u0643\u0648\u064A\u062A", "Management system — Kuwait")}</p>
    </div>
  </div>;
}
