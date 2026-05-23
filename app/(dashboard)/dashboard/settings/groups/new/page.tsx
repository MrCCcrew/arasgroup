"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowRight, Save } from "lucide-react";
import Link from "next/link";

export default function NewGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nameAr: "", nameEn: "", address: "", phone: "", email: "" });

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في الحفظ");
      router.push("/dashboard/settings");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header title="مجموعة جديدة" subtitle="إنشاء مجموعة شركات" />
      <div className="page-container max-w-xl">
        <Link href="/dashboard/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowRight size={14} /> العودة للإعدادات
        </Link>
        <form onSubmit={handleSubmit} className="section-card space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم المجموعة بالعربي <span className="text-red-500">*</span></label>
            <input type="text" required value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} className="input-field w-full" placeholder="مجموعة ..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">الاسم بالإنجليزي</label>
            <input type="text" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="input-field w-full" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">العنوان</label>
            <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} className="input-field w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">الهاتف</label>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input-field w-full" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-field w-full" dir="ltr" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} /> {loading ? "جاري الحفظ..." : "حفظ المجموعة"}
            </button>
            <Link href="/dashboard/settings" className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted">إلغاء</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
