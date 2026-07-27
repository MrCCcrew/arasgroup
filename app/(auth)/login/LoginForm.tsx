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
}

export default function LoginForm({ logoUrl, groupNameAr, groupNameEn }: Props) {
  const { locale } = useLocale();
  const english = locale === "en";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = english
    ? { signIn: "Sign in", email: "Email address", password: "Password", signingIn: "Signing in...", invalid: "Incorrect email or password", connection: "Unable to connect to the server", hide: "Hide password", show: "Show password", footer: "Management system — Kuwait" }
    : { signIn: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", email: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", password: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", signingIn: "\u062C\u0627\u0631\u064A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644...", invalid: "\u062E\u0637\u0623 \u0641\u064A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644", connection: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645", hide: "\u0625\u062E\u0641\u0627\u0621 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", show: "\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", footer: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u2014 \u0627\u0644\u0643\u0648\u064A\u062A" };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? copy.invalid);
        return;
      }
      window.location.assign(data.redirectTo ?? "/dashboard");
    } catch {
      setError(copy.connection);
    } finally {
      setLoading(false);
    }
  }

  return <div className="w-full max-w-md">
    <div className="mb-8 text-center">
      <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
      {logoUrl ? <div className="relative mx-auto mb-5 overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.55)]" style={{ width: 300, height: 170 }}><Image src={logoUrl} alt={english ? (groupNameEn ?? groupNameAr) : groupNameAr} fill className="object-contain p-3" unoptimized /></div> : <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary shadow-lg"><span className="text-4xl font-bold text-primary-foreground">\u0631</span></div>}
      <h1 className="text-2xl font-bold text-white">{english ? (groupNameEn ?? groupNameAr) : groupNameAr}</h1>
      {groupNameEn && !english && <p className="mt-1 text-sm text-slate-400" dir="ltr">{groupNameEn}</p>}
    </div>
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      <h2 className="mb-6 text-center text-xl font-bold text-slate-900">{copy.signIn}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">{error}</div>}
        <div className="space-y-1"><label className="block text-sm font-medium text-slate-700">{copy.email}</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@company.com" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary" dir="ltr" /></div>
        <div className="space-y-1"><label className="block text-sm font-medium text-slate-700">{copy.password}</label><div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="••••••••" className="w-full rounded-lg border border-slate-200 px-4 py-3 pe-12 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary" dir="ltr" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 left-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-700" aria-label={showPassword ? copy.hide : copy.show} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
        <button type="submit" disabled={loading} className="mt-2 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{loading ? copy.signingIn : copy.signIn}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">{copy.footer}</p>
    </div>
  </div>;
}
