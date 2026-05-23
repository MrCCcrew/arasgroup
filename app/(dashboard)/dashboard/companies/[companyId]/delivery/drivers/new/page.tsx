"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

export default function NewDriverPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    nationality: "",
    civilId: "",
    passportNumber: "",
    residencyNumber: "",
    residencyExpiry: "",
    phone: "",
    baseSalary: "",
    joinDate: new Date().toISOString().split("T")[0],
    talabatId: "",
    roPopsId: "",
    isRegisteredTalabat: false,
    isRegisteredRoPops: false,
  });

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/delivery/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          nameAr: form.nameAr,
          nameEn: form.nameEn || undefined,
          nationality: form.nationality || undefined,
          civilId: form.civilId || undefined,
          passportNumber: form.passportNumber || undefined,
          residencyNumber: form.residencyNumber || undefined,
          residencyExpiry: form.residencyExpiry || undefined,
          phone: form.phone || undefined,
          baseSalary: form.baseSalary ? Number.parseFloat(form.baseSalary) : undefined,
          joinDate: form.joinDate || undefined,
          talabatId: form.talabatId || undefined,
          roPopsId: form.roPopsId || undefined,
          isRegisteredTalabat: form.isRegisteredTalabat,
          isRegisteredRoPops: form.isRegisteredRoPops,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      }
      router.push(`/dashboard/companies/${companyId}/delivery/drivers`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New Driver" : "سائق جديد"}
        subtitle={locale === "en" ? "Add a delivery driver" : "إضافة سائق توصيل"}
        companyId={companyId}
      />
      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/drivers`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to drivers" : "العودة للسائقين"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Personal details" : "البيانات الشخصية"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Arabic name" : "الاسم بالعربي"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nameAr}
                  onChange={(event) => setField("nameAr", event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Driver full name" : "اسم السائق كاملاً"}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "English name" : "الاسم بالإنجليزي"}
                </label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(event) => setField("nameEn", event.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Nationality" : "الجنسية"}</label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(event) => setField("nationality", event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Example: Egyptian" : "مثال: مصري"}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Phone" : "الهاتف"}</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                  placeholder="+965 XXXX XXXX"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Civil ID" : "الرقم المدني"}</label>
                <input type="text" value={form.civilId} onChange={(event) => setField("civilId", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Passport number" : "رقم الجواز"}</label>
                <input type="text" value={form.passportNumber} onChange={(event) => setField("passportNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Residency number" : "رقم الإقامة"}</label>
                <input type="text" value={form.residencyNumber} onChange={(event) => setField("residencyNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Residency expiry" : "تاريخ انتهاء الإقامة"}</label>
                <input type="date" value={form.residencyExpiry} onChange={(event) => setField("residencyExpiry", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Base salary (KWD)" : "الراتب الأساسي (KWD)"}</label>
                <input type="number" min="0" step="0.001" value={form.baseSalary} onChange={(event) => setField("baseSalary", event.target.value)} className="input-field w-full" dir="ltr" placeholder="0.000" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Join date" : "تاريخ الالتحاق"}</label>
                <input type="date" value={form.joinDate} onChange={(event) => setField("joinDate", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Platform registration" : "تسجيل المنصات"}
            </h3>
            <div className="space-y-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  form.isRegisteredTalabat ? "border-orange-400 bg-orange-50" : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.isRegisteredTalabat}
                  onChange={(event) => setField("isRegisteredTalabat", event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-orange-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{locale === "en" ? "Registered in Talabat" : "مسجل في طلبات"}</p>
                  {form.isRegisteredTalabat && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-medium">Talabat ID</label>
                      <input
                        type="text"
                        value={form.talabatId}
                        onChange={(event) => setField("talabatId", event.target.value)}
                        className="input-field w-full"
                        dir="ltr"
                        placeholder="TAL-XXXXX"
                      />
                    </div>
                  )}
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  form.isRegisteredRoPops ? "border-blue-400 bg-blue-50" : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.isRegisteredRoPops}
                  onChange={(event) => setField("isRegisteredRoPops", event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{locale === "en" ? "Registered in Ro Pops" : "مسجل في Ro Pops"}</p>
                  {form.isRegisteredRoPops && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-medium">Ro Pops ID</label>
                      <input
                        type="text"
                        value={form.roPopsId}
                        onChange={(event) => setField("roPopsId", event.target.value)}
                        className="input-field w-full"
                        dir="ltr"
                        placeholder="ROP-XXXXX"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Add driver" : "إضافة السائق"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/delivery/drivers`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
