"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  logoUrl: string | null;
  groupNameAr: string;
  groupNameEn: string | null;
}

export default function LoginForm({ logoUrl, groupNameAr, groupNameEn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      {/* Logo & Title */}
      <div className="text-center mb-8">
        {logoUrl ? (
          <div className="relative w-36 h-36 mx-auto mb-5 rounded-2xl overflow-hidden bg-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3">
            <Image
              src={logoUrl}
              alt={groupNameAr}
              fill
              className="object-contain p-2"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-primary-foreground">ر</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-white">{groupNameAr}</h1>
        {groupNameEn && (
          <p className="text-slate-400 text-sm mt-1" dir="ltr">{groupNameEn}</p>
        )}
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">تسجيل الدخول</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@company.com"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
              dir="ltr"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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

        <p className="text-center text-xs text-slate-500 mt-6">
          نظام إدارة {groupNameAr} — الكويت
        </p>
      </div>
    </div>
  );
}
