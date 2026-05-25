"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";

export default function EditInvestorPage() {
  const { companyId, investorId } = useParams<{ companyId: string; investorId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    phone: "",
    phone2: "",
    civilId: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/investors?companyId=${companyId}`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) {
          const inv = payload.data.find((i: { id: string }) => i.id === investorId);
          if (inv) {
            setForm({
              nameAr: inv.nameAr ?? "",
              nameEn: inv.nameEn ?? "",
              phone: inv.phone ?? "",
              phone2: inv.phone2 ?? "",
              civilId: inv.civilId ?? "",
              email: inv.email ?? "",
              address: inv.address ?? "",
              notes: inv.notes ?? "",
            });
          }
        }
        setLoading(false);
      });
  }, [companyId, investorId]);

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/investors/${investorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          nameAr: form.nameAr,
          nameEn: form.nameEn || null,
          phone: form.phone || null,
          phone2: form.phone2 || null,
          civilId: form.civilId || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error ?? "فشل في الحفظ");
      router.push(`/dashboard/companies/${companyId}/investors/${investorId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div>
      <Header title="تعديل بيانات المسئول" subtitle={form.nameAr} companyId={companyId} />
      <div className="page-container max-w-xl">
        <div className="mb-4">
          <Link
            href={`/dashboard/companies/${companyId}/investors/${investorId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight size={14} />
            العودة لملف المسئول
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">الاسم بالعربي <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                value={form.nameAr}
                onChange={(e) => setField("nameAr", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">الاسم بالإنجليزي</label>
              <input
                type="text"
                dir="ltr"
                value={form.nameEn}
                onChange={(e) => setField("nameEn", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">رقم الهاتف</label>
              <input
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">رقم هاتف بديل</label>
              <input
                type="tel"
                dir="ltr"
                value={form.phone2}
                onChange={(e) => setField("phone2", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">الرقم المدني</label>
              <input
                type="text"
                dir="ltr"
                value={form.civilId}
                onChange={(e) => setField("civilId", e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="form-label">البريد الإلكتروني</label>
              <input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="form-label">العنوان</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="form-label">ملاحظات</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="input-field w-full resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/investors/${investorId}`}
              className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
