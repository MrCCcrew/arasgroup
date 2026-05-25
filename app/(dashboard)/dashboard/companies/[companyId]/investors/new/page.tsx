"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface BranchLink {
  branchId: string;
  ownershipPct: string;
  startDate: string;
}

export default function NewInvestorPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;

  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
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
  const [branchLinks, setBranchLinks] = useState<BranchLink[]>([]);

  useEffect(() => {
    fetch(`/api/companies/${companyId}/branches`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setBranches(payload.data);
      })
      .catch(() => {
        setError(locale === "en" ? "Failed to load branches" : "تعذر تحميل الفروع");
      });
  }, [companyId, locale]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function addBranchLink() {
    if (branches.length === 0) return;
    setBranchLinks((previous) => [
      ...previous,
      {
        branchId: branches[0].id,
        ownershipPct: "100",
        startDate: today,
      },
    ]);
  }

  function updateLink(index: number, field: keyof BranchLink, value: string) {
    setBranchLinks((previous) => previous.map((item, current) => (current === index ? { ...item, [field]: value } : item)));
  }

  function removeLink(index: number) {
    setBranchLinks((previous) => previous.filter((_, current) => current !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          ...form,
          branchLinks: branchLinks.map((link) => ({
            branchId: link.branchId,
            ownershipPct: parseFloat(link.ownershipPct) || 100,
            startDate: link.startDate,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Failed to save investor" : "فشل في حفظ البيانات"));
      router.push(`/dashboard/companies/${companyId}/investors`);
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
        title={locale === "en" ? "New Investor" : "مسئول جديد"}
        subtitle={locale === "en" ? "Add a new investor to this company" : "إضافة مسئول جديد إلى هذه الشركة"}
        companyId={companyId}
      />

      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/investors`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to investors" : "العودة للمسئولين"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Investor information" : "بيانات المسئول"}
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
                  placeholder={locale === "en" ? "Investor name" : "اسم المسئول"}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "English name" : "الاسم بالإنجليزي"}</label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(event) => setField("nameEn", event.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Phone" : "الهاتف"}</label>
                <input type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} className="input-field w-full" dir="ltr" placeholder="+965 XXXX XXXX" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Secondary phone" : "هاتف بديل"}</label>
                <input type="tel" value={form.phone2} onChange={(event) => setField("phone2", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Civil ID" : "الرقم المدني"}</label>
                <input type="text" value={form.civilId} onChange={(event) => setField("civilId", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Email" : "البريد الإلكتروني"}</label>
                <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Address" : "العنوان"}</label>
                <input type="text" value={form.address} onChange={(event) => setField("address", event.target.value)} className="input-field w-full" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} className="input-field h-20 w-full resize-none" />
              </div>
            </div>
          </div>

          <div className="section-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Linked branches" : "ربط بالفروع"}
              </h3>
              <button
                type="button"
                onClick={addBranchLink}
                disabled={branches.length === 0}
                className="flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-40"
              >
                <Plus size={14} />
                {locale === "en" ? "Add branch" : "إضافة فرع"}
              </button>
            </div>

            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "No branches exist for this company yet." : "لا توجد فروع مضافة لهذه الشركة بعد."}{" "}
                <Link href={`/dashboard/companies/${companyId}/investors/branches/new`} className="text-primary hover:underline">
                  {locale === "en" ? "Create a branch first" : "أضف فرعاً أولاً"}
                </Link>
              </p>
            ) : branchLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {locale === “en” ? 'Use “Add branch” to link this person to company branches.' : 'استخدم “إضافة فرع” لربط المسئول بفروع الشركة.'}
              </p>
            ) : (
              <div className="space-y-3">
                {branchLinks.map((link, index) => (
                  <div key={`${link.branchId}-${index}`} className="grid grid-cols-12 items-end gap-2 rounded-lg bg-muted/30 p-3">
                    <div className="col-span-5">
                      <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Branch" : "الفرع"}</label>
                      <select value={link.branchId} onChange={(event) => updateLink(index, "branchId", event.target.value)} className="input-field w-full">
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {locale === "en" ? branch.nameEn ?? branch.nameAr : branch.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Ownership %" : "نسبة الملكية %"}</label>
                      <input type="number" min="0" max="100" step="0.1" value={link.ownershipPct} onChange={(event) => updateLink(index, "ownershipPct", event.target.value)} className="input-field w-full text-center" dir="ltr" />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-xs font-medium">{locale === "en" ? "Start date" : "تاريخ البداية"}</label>
                      <input type="date" value={link.startDate} onChange={(event) => updateLink(index, "startDate", event.target.value)} className="input-field w-full" dir="ltr" />
                    </div>
                    <div className="col-span-1 flex justify-center pb-0.5">
                      <button type="button" onClick={() => removeLink(index)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Add investor" : "إضافة المسئول"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/investors`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
