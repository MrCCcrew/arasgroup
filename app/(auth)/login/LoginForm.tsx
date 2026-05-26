"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  logoUrl: string | null;
  groupNameAr: string;
  groupNameEn: string | null;
}

export default function LoginForm({ logoUrl, groupNameAr, groupNameEn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "خطأ في تسجيل الدخول");
        return;
      }

      window.location.assign("/dashboard");
      return;
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        {logoUrl ? (
          <div
            className="relative mx-auto mb-5 overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.55)]"
            style={{ width: 300, height: 170 }}
          >
            <Image src={logoUrl} alt={groupNameAr} fill className="object-contain p-3" unoptimized />
          </div>
        ) : (
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <span className="text-4xl font-bold text-primary-foreground">ر</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-white">{groupNameAr}</h1>
        {groupNameEn && (
          <p className="mt-1 text-sm text-slate-400" dir="ltr">
            {groupNameEn}
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="mb-6 text-center text-xl font-bold text-slate-900">تسجيل الدخول</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@company.com"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              dir="ltr"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 px-4 py-3 pe-12 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-700"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                جاري تسجيل الدخول...
              </span>
            ) : (
              "تسجيل الدخول"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">نظام إدارة {groupNameAr} - الكويت</p>
      </div>
    </div>
  );
}
