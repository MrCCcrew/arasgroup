"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2, UserCheck, Users } from "lucide-react";
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

interface Employee {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface Beneficiary {
  key: string;
  employeeId?: string;
  isInvestor: boolean;
  nameAr: string;
  nameEn?: string | null;
}

interface ClaimLine {
  descriptionAr: string;
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

const BENEFICIARY_TYPES = ["RESIDENCY_RENEWAL", "LICENSE_RENEWAL"];

const emptyLine = (): ClaimLine => ({
  descriptionAr: "",
  actualAmount: "",
  groupIncome: "0",
  notes: "",
});

export default function NewClaimPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const initialInvestorId = searchParams.get("investorId") ?? "";
  const initialType = searchParams.get("type") ?? "OTHER";
  const prefillEmployeeId = searchParams.get("prefillEmployeeId") ?? "";
  const prefillEmployeeNameAr = searchParams.get("prefillEmployeeNameAr") ?? "";
  const prefillEmployeeNameEn = searchParams.get("prefillEmployeeNameEn") ?? "";

  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [form, setForm] = useState({
    investorId: initialInvestorId,
    branchId: "",
    type: initialType,
    descriptionAr: "",
    claimDate: today,
    dueDate: "",
    notes: "",
  });
  const [lines, setLines] = useState<ClaimLine[]>([emptyLine()]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(
    prefillEmployeeId && prefillEmployeeNameAr
      ? [{ key: prefillEmployeeId, employeeId: prefillEmployeeId, isInvestor: false, nameAr: prefillEmployeeNameAr, nameEn: prefillEmployeeNameEn || null }]
      : []
  );

  const showBeneficiaries = BENEFICIARY_TYPES.includes(form.type);

  useEffect(() => {
    Promise.all([
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()),
    ])
      .then(([investorsPayload, branchesPayload]) => {
        if (investorsPayload.success) {
          setInvestors(investorsPayload.data);
          if (!initialInvestorId && investorsPayload.data.length > 0) {
            setForm((prev) => ({ ...prev, investorId: investorsPayload.data[0].id }));
          }
        }
        if (branchesPayload.success) setBranches(branchesPayload.data);
      })
      .catch(() => setError(locale === "en" ? "Failed to load form data" : "تعذر تحميل بيانات النموذج"));
  }, [companyId, initialInvestorId, locale]);

  useEffect(() => {
    if (!showBeneficiaries) return;
    const q = employeeSearch.trim();
    const url = `/api/hr/employees?companyId=${companyId}${q ? `&search=${encodeURIComponent(q)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((payload) => { if (payload.success) setEmployees(payload.data); })
      .catch(() => {});
  }, [companyId, showBeneficiaries, employeeSearch]);

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setLine(index: number, field: keyof ClaimLine, value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function addEmployeeBeneficiary(emp: Employee) {
    if (beneficiaries.some((b) => b.employeeId === emp.id)) return;
    setBeneficiaries((prev) => [
      ...prev,
      { key: emp.id, employeeId: emp.id, isInvestor: false, nameAr: emp.nameAr, nameEn: emp.nameEn },
    ]);
  }

  function addInvestorSelf() {
    if (beneficiaries.some((b) => b.isInvestor)) return;
    const investor = investors.find((i) => i.id === form.investorId);
    if (!investor) return;
    setBeneficiaries((prev) => [
      ...prev,
      { key: `investor:${investor.id}`, isInvestor: true, nameAr: investor.nameAr, nameEn: investor.nameEn },
    ]);
  }

  function removeBeneficiary(key: string) {
    setBeneficiaries((prev) => prev.filter((b) => b.key !== key));
  }

  const totalActual = lines.reduce((sum, l) => sum + (parseFloat(l.actualAmount) || 0), 0);
  const totalIncome = lines.reduce((sum, l) => sum + (parseFloat(l.groupIncome) || 0), 0);

  const availableEmployees = employees.filter(
    (emp) => !beneficiaries.some((b) => b.employeeId === emp.id)
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.investorId) {
      setError(locale === "en" ? "Please select an investor" : "يرجى اختيار المسئول");
      return;
    }

    if (lines.some((l) => !l.descriptionAr.trim())) {
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
          lines: lines.map((l) => ({
            descriptionAr: l.descriptionAr,
            actualAmount: parseFloat(l.actualAmount) || 0,
            groupIncome: parseFloat(l.groupIncome) || 0,
            notes: l.notes || undefined,
          })),
          beneficiaries: showBeneficiaries && beneficiaries.length > 0
            ? beneficiaries.map((b) => ({
                employeeId: b.employeeId,
                isInvestor: b.isInvestor,
                nameAr: b.nameAr,
                nameEn: b.nameEn,
              }))
            : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? (locale === "en" ? "Failed to save claim" : "فشل في حفظ المطالبة"));
      }

      router.push(`/dashboard/companies/${companyId}/investors/claims`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
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

          {/* بيانات المطالبة */}
          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Claim information" : "بيانات المطالبة"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Investor" : "المسئول والمدير"} <span className="text-red-500">*</span>
                </label>
                <select value={form.investorId} onChange={(e) => setField("investorId", e.target.value)} className="input-field w-full" required>
                  <option value="">{locale === "en" ? "Select investor" : "اختر المسئول"}</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {locale === "en" ? inv.nameEn ?? inv.nameAr : inv.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Branch" : "الفرع"}</label>
                <select value={form.branchId} onChange={(e) => setField("branchId", e.target.value)} className="input-field w-full">
                  <option value="">{locale === "en" ? "No branch" : "بدون فرع"}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {locale === "en" ? b.nameEn ?? b.nameAr : b.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Claim type" : "نوع المطالبة"} <span className="text-red-500">*</span>
                </label>
                <select value={form.type} onChange={(e) => { setField("type", e.target.value); setBeneficiaries([]); }} className="input-field w-full">
                  {Object.entries(claimTypeLabels[locale]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Claim date" : "تاريخ المطالبة"} <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.claimDate} onChange={(e) => setField("claimDate", e.target.value)} className="input-field w-full" required />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Description" : "البيان"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.descriptionAr}
                  onChange={(e) => setField("descriptionAr", e.target.value)}
                  className="input-field w-full"
                  required
                  minLength={3}
                  placeholder={locale === "en" ? "General claim description" : "وصف عام للمطالبة"}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Due date" : "تاريخ الاستحقاق"}</label>
                <input type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} className="input-field w-full" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Optional notes" : "ملاحظات اختيارية"}
                />
              </div>
            </div>
          </div>

          {/* المستفيدون — يظهر فقط لتجديد الإقامة / الرخصة */}
          {showBeneficiaries && (
            <div className="section-card space-y-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {locale === "en" ? "Beneficiaries" : "المستفيدون"}
                </h3>
              </div>

              {/* إضافة المسئول نفسه */}
              {form.investorId && !beneficiaries.some((b) => b.isInvestor) && (
                <button
                  type="button"
                  onClick={addInvestorSelf}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-primary/50 px-3 py-2 text-sm text-primary hover:bg-primary/5"
                >
                  <UserCheck size={15} />
                  {locale === "en" ? "Add the investor themselves" : "إضافة المسئول نفسه"}
                </button>
              )}

              {/* بحث موظف وإضافته */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="input-field w-full"
                    placeholder={locale === "en" ? "Search employee name..." : "ابحث عن اسم الموظف..."}
                  />
                </div>
              </div>

              {/* نتائج البحث */}
              {availableEmployees.length > 0 && employeeSearch.trim() && (
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-card shadow-sm">
                  {availableEmployees.slice(0, 10).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => { addEmployeeBeneficiary(emp); setEmployeeSearch(""); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-right"
                    >
                      <Plus size={13} className="shrink-0 text-primary" />
                      {emp.nameAr}
                      {emp.nameEn && <span className="text-muted-foreground">— {emp.nameEn}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* قائمة المستفيدين المختارين */}
              {beneficiaries.length > 0 && (
                <div className="space-y-1.5">
                  {beneficiaries.map((b) => (
                    <div key={b.key} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        {b.isInvestor && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {locale === "en" ? "Investor" : "المسئول"}
                          </span>
                        )}
                        <span className="font-medium">{b.nameAr}</span>
                        {b.nameEn && <span className="text-muted-foreground text-xs">{b.nameEn}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBeneficiary(b.key)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {beneficiaries.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {locale === "en"
                    ? "No beneficiaries added yet. Add the investor themselves or search for an employee."
                    : "لم يُضَف أي مستفيد بعد. أضف المسئول نفسه أو ابحث عن موظف."}
                </p>
              )}
            </div>
          )}

          {/* بنود المطالبة */}
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
                    <th className="w-36 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Required amount" : "المبلغ المطلوب"}</th>
                    <th className="w-36 px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Group income" : "دخل المجموعة"}</th>
                    <th className="px-3 py-2 text-right font-bold text-muted-foreground">{locale === "en" ? "Notes" : "ملاحظات"}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.descriptionAr}
                          onChange={(e) => setLine(index, "descriptionAr", e.target.value)}
                          className="input-field w-full"
                          placeholder={locale === "en" ? "Line description" : "وصف البند"}
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" value={line.actualAmount} onChange={(e) => setLine(index, "actualAmount", e.target.value)} className="input-field w-full" dir="ltr" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.001" min="0" value={line.groupIncome} onChange={(e) => setLine(index, "groupIncome", e.target.value)} className="input-field w-full text-green-600" dir="ltr" placeholder="0.000" />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => setLine(index, "notes", e.target.value)}
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
