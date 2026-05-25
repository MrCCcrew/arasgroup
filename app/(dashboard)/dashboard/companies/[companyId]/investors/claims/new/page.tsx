"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Investor {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface Branch {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface ClaimLine {
  descriptionAr: string;
  collectedAmount: string;
  actualAmount: string;
  groupIncome: string;
  notes: string;
}

const claimTypeLabels = {
  ar: {
    LICENSE_RENEWAL: "تجديد رخصة",
    RESIDENCY_RENEWAL: "تجديد إقامة",
    RENT: "إيجار",
    SALARY_FUNDING: "تمويل رواتب",
    ADMIN_FEE: "رسوم إدارية",
    FINE: "غرامة",
    OTHER: "أخرى",
  },
  en: {
    LICENSE_RENEWAL: "License renewal",
    RESIDENCY_RENEWAL: "Residency renewal",
    RENT: "Rent",
    SALARY_FUNDING: "Salary funding",
    ADMIN_FEE: "Administrative fee",
    FINE: "Fine",
    OTHER: "Other",
  },
} as const;

const emptyLine = (): ClaimLine => ({
  descriptionAr: "",
  collectedAmount: "",
  actualAmount: "",
  groupIncome: "0",
  notes: "",
});

export default function NewClaimPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const companyId = params.companyId;
  const initialInvestorId = searchParams.get("investorId") ?? "";

  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({
    investorId: initialInvestorId,
    branchId: "",
    type: "OTHER",
    descriptionAr: "",
    claimDate: today,
    dueDate: "",
    notes: "",
  });
  const [lines, setLines] = useState<ClaimLine[]>([emptyLine()]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/investors?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/companies/${companyId}/branches`).then((response) => response.json()),
    ])
      .then(([investorsPayload, branchesPayload]) => {
        if (investorsPayload.success) {
          setInvestors(investorsPayload.data);
          if (!initialInvestorId && investorsPayload.data.length > 0) {
            setForm((previous) => ({ ...previous, investorId: investorsPayload.data[0].id }));
          }
        }
        if (branchesPayload.success) {
          setBranches(branchesPayload.data);
        }
      })
      .catch(() => {
        setError(locale === "en" ? "Failed to load form data" : "تعذر تحميل بيانات النموذج");
      });
  }, [companyId, initialInvestorId, locale]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function setLine(index: number, field: keyof ClaimLine, value: string) {
    setLines((previous) => {
      const next = [...previous];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLine() {
    setLines((previous) => [...previous, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }

  const totalCollected = lines.reduce((sum, line) => sum + (parseFloat(line.collectedAmount) || 0), 0);
  const totalActual = lines.reduce((sum, line) => sum + (parseFloat(line.actualAmount) || 0), 0);
  const totalIncome = lines.reduce((sum, line) => sum + (parseFloat(line.groupIncome) || 0), 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.investorId) {
      setError(locale === "en" ? "Please select an investor" : "يرجى اختيار المسئول");
      return;
    }

    if (lines.some((line) => !line.descriptionAr.trim())) {
      setError(locale === "en" ? "Each line must include a description" : "يرجى إدخال وصف لكل بند");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/investors/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          investorId: form.investorId,
          branchId: form.branchId || undefined,
          type: form.type,
          descriptionAr: form.descriptionAr,
          claimDate: form.claimDate,
          dueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
          lines: lines.map((line) => ({
            descriptionAr: line.descriptionAr,
            collectedAmount: parseFloat(line.collectedAmount) || 0,
            actualAmount: parseFloat(line.actualAmount) || 0,
            groupIncome: parseFloat(line.groupIncome) || 0,
            notes: line.notes || undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to save claim" : "فشل في حفظ المطالبة"));
      }

      router.push(`/dashboard/companies/${companyId}/investors/claims`);
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
        title={locale === "en" ? "New Investor Claim" : "مطالبة جديدة"}
        subtitle={locale === "en" ? "Register a financial claim for an investor" : "تسجيل مطالبة مالية على مسئول"}
        companyId={companyId}
      />

      <div className="page-container max-w-5xl">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/investors/claims`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {locale === "en" ? "Back to claims" : "العودة للمطالبات"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Claim information" : "بيانات المطالبة"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Investor" : "المسئول والمدير"} <span className="text-red-500">*</span>
                </label>
                <select value={form.investorId} onChange={(event) => setField("investorId", event.target.value)} className="input-field w-full" required>
                  <option value="">{locale === "en" ? "Select investor" : "اختر المسئول"}</option>
                  {investors.map((investor) => (
                    <option key={investor.id} value={investor.id}>
                      {locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Branch" : "الفرع"}</label>
                <select value={form.branchId} onChange={(event) => setField("branchId", event.target.value)} className="input-field w-full">
                  <option value="">{locale === "en" ? "No branch" : "بدون فرع"}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {locale === "en" ? branch.nameEn ?? branch.nameAr : branch.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Claim type" : "نوع المطالبة"} <span className="text-red-500">*</span>
                </label>
                <select value={form.type} onChange={(event) => setField("type", event.target.value)} className="input-field w-full">
                  {Object.entries(claimTypeLabels[locale]).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Claim date" : "تاريخ المطالبة"} <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.claimDate} onChange={(event) => setField("claimDate", event.target.value)} className="input-field w-full" required />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Description" : "البيان"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.descriptionAr}
                  onChange={(event) => setField("descriptionAr", event.target.value)}
                  className="input-field w-full"
                  required
                  minLength={3}
                  placeholder={locale === "en" ? "General claim description" : "وصف عام للمطالبة"}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Due date" : "تاريخ الاستحقاق"}</label>
                <input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} className="input-field w-full" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Optional notes" : "ملاحظات اختيارية"}
                />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Claim lines" : "بنود المطالبة"}
              </h3>
              <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Plus size={14} />
                {locale === "en" ? "Add line" : "إضافة بند"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Description" : "البيان"}</th>
                    <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Collected amount" : "المبلغ المحصل"}</th>
                    <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Actual amount" : "المبلغ الفعلي"}</th>
                    <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Group income" : "دخل المجموعة"}</th>
                    <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Notes" : "ملاحظات"}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${line.descriptionAr}-${index}`} className="border-b border-border">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.descriptionAr}
                          onChange={(event) => setLine(index, "descriptionAr", event.target.value)}
                          className="input-field w-full"
                          placeholder={locale === "en" ? "Line description" : "وصف البند"}
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" value={line.collectedAmount} onChange={(event) => setLine(index, "collectedAmount", event.target.value)} className="input-field w-full" dir="ltr" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" value={line.actualAmount} onChange={(event) => setLine(index, "actualAmount", event.target.value)} className="input-field w-full" dir="ltr" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" value={line.groupIncome} onChange={(event) => setLine(index, "groupIncome", event.target.value)} className="input-field w-full text-green-600" dir="ltr" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(event) => setLine(index, "notes", event.target.value)}
                          className="input-field w-full"
                          placeholder={locale === "en" ? "Optional note" : "ملاحظة اختيارية"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(index)} className="text-red-500 transition-colors hover:text-red-700">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td className="px-3 py-2 text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="px-3 py-2 text-left number">{totalCollected.toFixed(3)}</td>
                    <td className="px-3 py-2 text-left number">{totalActual.toFixed(3)}</td>
                    <td className="px-3 py-2 text-left number text-green-600">{totalIncome.toFixed(3)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save claim" : "حفظ المطالبة"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/investors/claims`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
