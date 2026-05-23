"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

export default function NewBranchPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    address: "",
    phone: "",
    sortOrder: "0",
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/companies/${companyId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sortOrder: parseInt(form.sortOrder, 10) || 0,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Failed to save branch" : "فشل في حفظ الفرع"));
      router.push(`/dashboard/companies/${companyId}/investors/branches`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New Branch" : "فرع جديد"}
        subtitle={locale === "en" ? "Add a new branch to this company" : "إضافة فرع جديد إلى الشركة"}
        companyId={companyId}
      />

      <div className="page-container max-w-xl">
        <Link
          href={`/dashboard/companies/${companyId}/investors/branches`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to branches" : "العودة للفروع"}
        </Link>

        <form onSubmit={handleSubmit} className="section-card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {locale === "en" ? "Branch information" : "بيانات الفرع"}
          </h3>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {locale === "en" ? "Arabic branch name" : "اسم الفرع بالعربي"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nameAr}
              onChange={(event) => setField("nameAr", event.target.value)}
              className="input-field w-full"
              placeholder={locale === "en" ? "Example: Jahra Branch" : "مثال: فرع الجهراء"}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "English name" : "الاسم بالإنجليزي"}</label>
            <input
              type="text"
              value={form.nameEn}
              onChange={(event) => setField("nameEn", event.target.value)}
              className="input-field w-full"
              dir="ltr"
              placeholder="Jahra Branch"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Phone" : "الهاتف"}</label>
              <input type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} className="input-field w-full" dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Display order" : "ترتيب العرض"}</label>
              <input type="number" min="0" value={form.sortOrder} onChange={(event) => setField("sortOrder", event.target.value)} className="input-field w-full text-center" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Address" : "العنوان"}</label>
            <input type="text" value={form.address} onChange={(event) => setField("address", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "District, area..." : "الحي، المنطقة..."} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Add branch" : "إضافة الفرع"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/investors/branches`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
