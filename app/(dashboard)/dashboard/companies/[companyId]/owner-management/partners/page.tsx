"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Partner = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  mid: string;
  isActive: boolean;
  user: { email: string };
};

const emptyForm = { name: "", phone: "", email: "", password: "", mid: "" };

async function readJson(response: Response) {
  const body = await response.text();
  try { return body ? JSON.parse(body) : {}; } catch { return {}; }
}

export default function OwnerManagedPartnersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/owner-management/companies/${companyId}/partners`);
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل الشركاء");
      setPartners(payload.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الشركاء");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void loadPartners(); }, [loadPartners]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/owner-management/companies/${companyId}/partners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "تعذر إضافة الشريك");
      setForm(emptyForm);
      setShowForm(false);
      await loadPartners();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إضافة الشريك");
    } finally {
      setSaving(false);
    }
  }

  return <div className="page-container space-y-6" dir="rtl">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">الشركاء</h1><p className="text-sm text-muted-foreground">إدارة الشركاء وأرقام أجهزة الدفع MID.</p></div>
      <button type="button" onClick={() => setShowForm(value => !value)} className="rounded bg-primary px-4 py-2 text-primary-foreground">إضافة شريك</button>
    </div>

    {showForm && <form onSubmit={submit} className="section-card grid gap-3 md:grid-cols-2">
      <input required placeholder="اسم الشريك" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded border p-2" />
      <input required type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="rounded border p-2" />
      <input placeholder="الهاتف" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="rounded border p-2" />
      <input required placeholder="MID" value={form.mid} onChange={event => setForm({ ...form, mid: event.target.value })} className="rounded border p-2" />
      <input required minLength={8} type="password" placeholder="كلمة مرور مؤقتة" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="rounded border p-2" />
      <div><button disabled={saving} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{saving ? "جارٍ الحفظ..." : "حفظ الشريك"}</button></div>
    </form>}

    {error && <p role="alert" className="rounded border border-destructive p-3 text-sm text-destructive">{error}</p>}
    <div className="section-card overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead><tr className="border-b text-muted-foreground"><th className="p-2">الاسم</th><th className="p-2">الهاتف</th><th className="p-2">البريد</th><th className="p-2">MID</th><th className="p-2">الحالة</th><th className="p-2"> </th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="p-4 text-center">جارٍ التحميل...</td></tr> : partners.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">لا يوجد شركاء بعد.</td></tr> : partners.map(partner => <tr key={partner.id} className="border-b last:border-0"><td className="p-2">{partner.name}</td><td className="p-2" dir="ltr">{partner.phone || "—"}</td><td className="p-2" dir="ltr">{partner.email || partner.user.email}</td><td className="p-2" dir="ltr">{partner.mid}</td><td className="p-2">{partner.isActive ? "نشط" : "غير نشط"}</td><td className="p-2"><Link className="text-primary underline" href={`/dashboard/companies/${companyId}/owner-management/partners/${partner.id}`}>فتح</Link></td></tr>)}</tbody>
      </table>
    </div>
    <Link className="text-sm text-primary underline" href={`/dashboard/companies/${companyId}/owner-management`}>العودة للوحة إدارة المالك</Link>
  </div>;
}
