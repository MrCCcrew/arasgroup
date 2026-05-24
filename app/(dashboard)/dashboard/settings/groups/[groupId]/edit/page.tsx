"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowRight, Save, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { GroupLogoUpload } from "@/components/group/GroupLogoUpload";

interface Company { id: string; nameAr: string; isActive: boolean; }
interface Group {
  id: string; nameAr: string; nameEn?: string;
  address?: string; phone?: string; email?: string;
  logoUrl?: string | null;
  companies: Company[];
}

export default function EditGroupPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    nameAr: "", nameEn: "", address: "", phone: "", email: "",
  });

  useEffect(() => {
    fetch(`/api/groups/${groupId}`).then((r) => r.json()).then((d) => {
      if (d.success) {
        const g: Group = d.data;
        setGroup(g);
        setForm({
          nameAr: g.nameAr,
          nameEn: g.nameEn ?? "",
          address: g.address ?? "",
          phone: g.phone ?? "",
          email: g.email ?? "",
        });
      }
    });
  }, [groupId]);

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
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

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في الحذف");
      router.push("/dashboard/settings");
    } catch (err: any) {
      setError(err.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!group) {
    return (
      <div>
        <Header title="تعديل المجموعة" />
        <div className="page-container">
          <div className="section-card text-center py-12 text-muted-foreground">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  const activeCompanies = group.companies.filter((c) => c.isActive);

  return (
    <div>
      <Header title={`تعديل — ${group.nameAr}`} subtitle="إعدادات المجموعة" />
      <div className="page-container max-w-xl">
        <Link href="/dashboard/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowRight size={14} /> العودة للإعدادات
        </Link>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Logo Upload */}
          <div className="section-card">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-4">شعار المجموعة</h3>
            <GroupLogoUpload
              groupId={groupId}
              currentLogoUrl={group.logoUrl ?? null}
              groupName={group.nameAr}
            />
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="section-card space-y-4">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">بيانات المجموعة</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">الاسم بالعربي <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">الاسم بالإنجليزي</label>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                className="input-field w-full"
                dir="ltr"
              />
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
            <div>
              <label className="block text-sm font-medium mb-1.5">العنوان</label>
              <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} className="input-field w-full" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
              </button>
              <Link href="/dashboard/settings" className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted">
                إلغاء
              </Link>
            </div>
          </form>

          {/* Companies in this group */}
          <div className="section-card">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              الشركات في هذه المجموعة ({activeCompanies.length})
            </h3>
            {activeCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد شركات نشطة</p>
            ) : (
              <ul className="space-y-2">
                {activeCompanies.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                    <span>{c.nameAr}</span>
                    <Link
                      href={`/dashboard/settings/companies/${c.id}/edit`}
                      className="text-xs text-primary hover:underline"
                    >
                      تعديل / فصل
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete Group */}
          <div className="section-card border-red-200 space-y-3">
            <h3 className="font-bold text-sm text-red-600 uppercase tracking-wide">منطقة الخطر</h3>

            {activeCompanies.length > 0 ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <span>لا يمكن حذف المجموعة لأنها تحتوي على {activeCompanies.length} شركة نشطة. انقل الشركات لمجموعة أخرى أولاً.</span>
              </div>
            ) : !confirmDelete ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">حذف هذه المجموعة نهائياً</p>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  حذف المجموعة
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">هل أنت متأكد من حذف مجموعة <strong>{group.nameAr}</strong>؟ هذا الإجراء لا يمكن التراجع عنه.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deleting ? "جاري الحذف..." : "نعم، احذف"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
