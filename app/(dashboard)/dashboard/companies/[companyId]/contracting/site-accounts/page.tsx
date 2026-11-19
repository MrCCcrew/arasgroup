"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, KeyRound, Plus, Power, Trash2, Users } from "lucide-react";
import { useParams } from "next/navigation";

type SiteUser = { id: string; nameAr: string; nameEn?: string | null; email: string; phone?: string | null; isActive: boolean; createdAt: string; submissionsCount: number };
const emptyForm = { nameAr: "", nameEn: "", email: "", phone: "", password: "" };

export default function ContractingSiteAccountsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [resetUser, setResetUser] = useState<SiteUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/companies/${companyId}/contracting/site-accounts`);
    const body = await response.json();
    if (response.ok) setUsers(body.data ?? []);
    else setMessage(body.error ?? "تعذر تحميل الحسابات");
    setLoading(false);
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch(`/api/companies/${companyId}/contracting/site-accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setMessage(body.error ?? "تعذر إنشاء الحساب");
    setForm(emptyForm); setMessage("تم إنشاء حساب موظف الموقع."); await load();
  }
  async function update(user: SiteUser, data: object) {
    setMessage("");
    const response = await fetch(`/api/companies/${companyId}/contracting/site-accounts/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error ?? "تعذر حفظ التعديل");
    setMessage("تم حفظ التعديل."); setResetUser(null); setNewPassword(""); await load();
  }
  async function remove(user: SiteUser) {
    if (!window.confirm(`إلغاء حساب ${user.nameAr} نهائياً؟`)) return;
    const response = await fetch(`/api/companies/${companyId}/contracting/site-accounts/${user.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error ?? "تعذر إلغاء الحساب");
    setMessage("تم إلغاء الحساب."); await load();
  }

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-16 sm:p-6" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="text-orange-600" /> حسابات موظفي الموقع</h1><p className="mt-1 text-sm text-muted-foreground">أنشئ حسابات رفع فواتير وإيصالات إيداع لمشاريع هذه الشركة فقط.</p></div>
      <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">{users.length} حساب</span>
    </div>
    {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <form onSubmit={create} className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-bold"><Plus size={18} /> إضافة حساب موظف موقع</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="الاسم بالعربي *" value={form.nameAr} onChange={value => setForm({ ...form, nameAr: value })} required />
        <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={value => setForm({ ...form, nameEn: value })} />
        <Input label="البريد الإلكتروني *" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} required />
        <Input label="رقم الهاتف" value={form.phone} onChange={value => setForm({ ...form, phone: value })} />
        <Input label="كلمة المرور *" type="password" value={form.password} onChange={value => setForm({ ...form, password: value })} required />
      </div>
      <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />{saving ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
    </form>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4 font-bold">الحسابات الحالية</div>
      {loading ? <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div> : users.length === 0 ? <div className="p-8 text-center text-muted-foreground">لا توجد حسابات لموظفي الموقع بعد.</div> : <div className="divide-y">{users.map(user => <div key={user.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2 font-bold">{user.nameAr}<span className={`rounded-full px-2 py-0.5 text-xs ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.isActive ? "نشط" : "موقوف"}</span></div><div className="mt-1 text-sm text-muted-foreground">{user.email}{user.phone ? ` · ${user.phone}` : ""}</div><div className="mt-1 text-xs text-muted-foreground">رفع {user.submissionsCount} مستند</div></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setResetUser(user)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><KeyRound size={15} /> كلمة المرور</button><button onClick={() => void update(user, { isActive: !user.isActive })} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><Power size={15} />{user.isActive ? "إيقاف" : "تفعيل"}</button><button onClick={() => void remove(user)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"><Trash2 size={15} /> إلغاء</button></div>
      </div>)}</div>}
    </section>
    {resetUser && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={event => { event.preventDefault(); void update(resetUser, { password: newPassword }); }} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"><h2 className="font-bold">تغيير كلمة مرور {resetUser.nameAr}</h2><input autoFocus type="password" required minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="8 أحرف على الأقل" className="mt-4 w-full rounded-lg border px-3 py-2.5" /><div className="mt-5 flex gap-2"><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">حفظ</button><button type="button" onClick={() => setResetUser(null)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button></div></form></div>}
  </main>;
}
function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="grid gap-1 text-sm font-medium">{label}<input type={type} required={required} value={value} onChange={event => onChange(event.target.value)} className="rounded-lg border bg-background px-3 py-2.5 outline-none focus:border-orange-500" /></label>; }
