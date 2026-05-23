"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowRight, Save } from "lucide-react";
import Link from "next/link";

interface Group { id: string; nameAr: string; }

const companyTypes = [
  { value: "DELIVERY",  label: "توصيل طلبات" },
  { value: "CAR_WASH",  label: "غسيل سيارات" },
  { value: "TRADING",   label: "تجارة عامة" },
  { value: "HOLDING",   label: "شركة قابضة" },
  { value: "OTHER",     label: "أخرى" },
];

export default function NewCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGroupId = searchParams.get("groupId") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [createNewGroup, setCreateNewGroup] = useState(false);

  const [form, setForm] = useState({
    groupId: preselectedGroupId,
    newGroupNameAr: "",
    nameAr: "",
    nameEn: "",
    type: "TRADING",
    commercialReg: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    fetch("/api/groups").then((r) => r.json()).then((d) => {
      if (d.success) {
        setGroups(d.data);
        if (!preselectedGroupId && d.data.length > 0) {
          setForm((p) => ({ ...p, groupId: d.data[0].id }));
        }
      }
    });
  }, [preselectedGroupId]);

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let groupId = form.groupId;

      if (createNewGroup) {
        if (!form.newGroupNameAr) throw new Error("اسم المجموعة الجديدة مطلوب");
        const gr = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr: form.newGroupNameAr }),
        }).then((r) => r.json());
        if (!gr.success) throw new Error(gr.error);
        groupId = gr.data.id;
      }

      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          nameAr: form.nameAr,
          nameEn: form.nameEn || undefined,
          type: form.type,
          commercialReg: form.commercialReg || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
        }),
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
      <Header title="شركة جديدة" subtitle="إضافة شركة للنظام" />
      <div className="page-container max-w-2xl">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowRight size={14} /> العودة للإعدادات
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Group Selection */}
          <div className="section-card space-y-4">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">المجموعة</h3>
            <p className="text-sm text-muted-foreground">
              الشركات داخل نفس المجموعة مرتبطة ببعضها وتظهر معاً في لوحة التحكم.
              اختر مجموعة منفصلة إذا أردت عزل الشركة تماماً.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCreateNewGroup(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${!createNewGroup ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                ربط بمجموعة موجودة
              </button>
              <button
                type="button"
                onClick={() => setCreateNewGroup(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${createNewGroup ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                مجموعة جديدة (منفصلة)
              </button>
            </div>

            {createNewGroup ? (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  اسم المجموعة الجديدة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.newGroupNameAr}
                  onChange={(e) => set("newGroupNameAr", e.target.value)}
                  className="input-field w-full"
                  placeholder="مجموعة ..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  اختر المجموعة <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.groupId}
                  onChange={(e) => set("groupId", e.target.value)}
                  required={!createNewGroup}
                  className="input-field w-full"
                >
                  <option value="">اختر مجموعة...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.nameAr}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Company Info */}
          <div className="section-card space-y-4">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">بيانات الشركة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">
                  اسم الشركة بالعربي <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nameAr}
                  onChange={(e) => set("nameAr", e.target.value)}
                  className="input-field w-full"
                  placeholder="شركة ..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">الاسم بالإنجليزي</label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(e) => set("nameEn", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  نوع النشاط <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  className="input-field w-full"
                >
                  {companyTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">السجل التجاري</label>
                <input
                  type="text"
                  value={form.commercialReg}
                  onChange={(e) => set("commercialReg", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الهاتف</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">العنوان</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? "جاري الحفظ..." : "إنشاء الشركة"}
            </button>
            <Link
              href="/dashboard/settings"
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
