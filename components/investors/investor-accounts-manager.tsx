"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Plus, Printer, Send, Wallet } from "lucide-react";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { buildInvestorSalaryFundingReminder, buildWhatsAppUrl } from "@/lib/whatsapp";
import { formatDate, formatKWD, formatMonthYear, toNumber } from "@/lib/utils";

type Option = { id: string; nameAr: string; nameEn?: string | null };
type LicenseOption = Option & { licenseNumber: string };
type Agreement = {
  id: string;
  titleAr: string;
  titleEn?: string | null;
  chargeCategory: string;
  claimType: string;
  billingCycle: string;
  amount: number | string;
  dueDay?: number | null;
  dueMonth?: number | null;
  startDate?: string | Date | null;
  nextDueDate?: string | Date | null;
  isActive: boolean;
  autoCreateClaim: boolean;
  notes?: string | null;
  branch?: Option | null;
  license?: LicenseOption | null;
  employee?: Option | null;
};
type SalaryProfile = {
  id: string;
  branch?: Option | null;
  workersCount: number;
  monthlyAmount: number | string;
  collectionStartDay: number;
  collectionEndDay: number;
  whatsappTemplateAr?: string | null;
  whatsappTemplateEn?: string | null;
  isActive: boolean;
  notes?: string | null;
};
type Claim = {
  id: string;
  type: string;
  descriptionAr: string;
  claimDate: string | Date;
  dueDate?: string | Date | null;
  status: string;
  lines: Array<{ actualAmount: number | string; collectedAmount: number | string }>;
};
type SalaryCollection = {
  id: string;
  month: number;
  year: number;
  collectedAmount: number | string;
  collectedDate: string | Date;
  status: string;
};

interface Props {
  companyId: string;
  investorId: string;
  investorName: string;
  investorPhone?: string | null;
  branches: Option[];
  licenses: LicenseOption[];
  employees: Option[];
  agreements: Agreement[];
  salaryProfiles: SalaryProfile[];
  claims: Claim[];
  salaryCollections: SalaryCollection[];
}

const claimTypeOptions = [
  { value: "LICENSE_RENEWAL", label: "تجديد ترخيص" },
  { value: "RESIDENCY_RENEWAL", label: "تجديد إقامة" },
  { value: "RENT", label: "إيجار" },
  { value: "SALARY_FUNDING", label: "تمويل رواتب" },
  { value: "ADMIN_FEE", label: "رسوم إدارية" },
  { value: "FINE", label: "غرامة" },
  { value: "OTHER", label: "أخرى" },
] as const;

const chargeCategoryOptions = [
  { value: "MONTHLY_FEE", label: "مبلغ شهري" },
  { value: "ANNUAL_FEE", label: "مبلغ سنوي" },
  { value: "RENT", label: "إيجار" },
  { value: "LICENSE_ISSUANCE", label: "إنشاء ترخيص" },
  { value: "LICENSE_RENEWAL", label: "تجديد ترخيص" },
  { value: "EMPLOYEE_RESIDENCY_RENEWAL", label: "تجديد إقامات العمال" },
  { value: "INVESTOR_RESIDENCY_RENEWAL", label: "تجديد إقامة المستثمر" },
  { value: "SALARY_FUNDING", label: "تمويل رواتب" },
  { value: "OTHER", label: "أخرى" },
] as const;

const billingCycleOptions = [
  { value: "MONTHLY", label: "شهري" },
  { value: "ANNUAL", label: "سنوي" },
  { value: "MANUAL", label: "يدوي" },
  { value: "ONE_TIME", label: "مرة واحدة" },
] as const;

const emptyAgreement = {
  titleAr: "",
  titleEn: "",
  branchId: "",
  licenseId: "",
  employeeId: "",
  chargeCategory: "MONTHLY_FEE",
  claimType: "ADMIN_FEE",
  billingCycle: "MONTHLY",
  amount: "",
  dueDay: "",
  dueMonth: "",
  startDate: "",
  nextDueDate: "",
  autoCreateClaim: false,
  isActive: true,
  notes: "",
};

const emptyProfile = {
  branchId: "",
  workersCount: "0",
  monthlyAmount: "",
  collectionStartDay: "22",
  collectionEndDay: "31",
  whatsappTemplateAr: "",
  whatsappTemplateEn: "",
  isActive: true,
  notes: "",
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    SENT_TO_ACCOUNTANT: "bg-blue-100 text-blue-800",
    SENT_TO_INVESTOR: "bg-indigo-100 text-indigo-800",
    PARTIALLY_COLLECTED: "bg-orange-100 text-orange-800",
    COLLECTED: "bg-teal-100 text-teal-800",
    COMPLETED: "bg-green-100 text-green-800",
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-600",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

export function InvestorAccountsManager(props: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [agreementMode, setAgreementMode] = useState<"create" | "edit">("create");
  const [agreementEditId, setAgreementEditId] = useState<string | null>(null);
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [agreementError, setAgreementError] = useState("");

  const [profileMode, setProfileMode] = useState<"create" | "edit">("create");
  const [profileEditId, setProfileEditId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [profileError, setProfileError] = useState("");

  const totals = useMemo(() => {
    const actual = props.claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + toNumber(line.actualAmount), 0), 0);
    const collected = props.claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + toNumber(line.collectedAmount), 0), 0);
    const salaryCollected = props.salaryCollections.reduce((sum, item) => sum + toNumber(item.collectedAmount), 0);
    return {
      actual,
      collected,
      remaining: actual - collected,
      salaryCollected,
    };
  }, [props.claims, props.salaryCollections]);

  function resetAgreementForm() {
    setAgreementMode("create");
    setAgreementEditId(null);
    setAgreementForm(emptyAgreement);
    setAgreementError("");
  }

  function resetProfileForm() {
    setProfileMode("create");
    setProfileEditId(null);
    setProfileForm(emptyProfile);
    setProfileError("");
  }

  function editAgreement(item: Agreement) {
    setAgreementMode("edit");
    setAgreementEditId(item.id);
    setAgreementError("");
    setAgreementForm({
      titleAr: item.titleAr,
      titleEn: item.titleEn ?? "",
      branchId: item.branch?.id ?? "",
      licenseId: item.license?.id ?? "",
      employeeId: item.employee?.id ?? "",
      chargeCategory: item.chargeCategory,
      claimType: item.claimType,
      billingCycle: item.billingCycle,
      amount: String(toNumber(item.amount)),
      dueDay: item.dueDay ? String(item.dueDay) : "",
      dueMonth: item.dueMonth ? String(item.dueMonth) : "",
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
      nextDueDate: item.nextDueDate ? String(item.nextDueDate).slice(0, 10) : "",
      autoCreateClaim: item.autoCreateClaim,
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
  }

  function editProfile(item: SalaryProfile) {
    setProfileMode("edit");
    setProfileEditId(item.id);
    setProfileError("");
    setProfileForm({
      branchId: item.branch?.id ?? "",
      workersCount: String(item.workersCount),
      monthlyAmount: String(toNumber(item.monthlyAmount)),
      collectionStartDay: String(item.collectionStartDay),
      collectionEndDay: String(item.collectionEndDay),
      whatsappTemplateAr: item.whatsappTemplateAr ?? "",
      whatsappTemplateEn: item.whatsappTemplateEn ?? "",
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
  }

  async function readJsonResponse(res: Response) {
    const text = await res.text();
    if (!text) {
      return {
        success: false,
        error: res.ok ? "استجابة فارغة من الخادم" : `فشل الطلب (${res.status})`,
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: res.ok ? "تعذر قراءة استجابة الخادم" : `فشل الطلب (${res.status})`,
      };
    }
  }

  async function saveAgreement() {
    setAgreementError("");
    if (!agreementForm.titleAr.trim()) {
      setAgreementError("عنوان الاتفاق مطلوب");
      return;
    }

    const payload = {
      companyId: props.companyId,
      investorId: props.investorId,
      branchId: agreementForm.branchId || null,
      licenseId: agreementForm.licenseId || null,
      employeeId: agreementForm.employeeId || null,
      titleAr: agreementForm.titleAr,
      titleEn: agreementForm.titleEn || null,
      chargeCategory: agreementForm.chargeCategory,
      claimType: agreementForm.claimType,
      billingCycle: agreementForm.billingCycle,
      amount: Number(agreementForm.amount || 0),
      dueDay: agreementForm.dueDay ? Number(agreementForm.dueDay) : null,
      dueMonth: agreementForm.dueMonth ? Number(agreementForm.dueMonth) : null,
      startDate: agreementForm.startDate || null,
      nextDueDate: agreementForm.nextDueDate || null,
      autoCreateClaim: agreementForm.autoCreateClaim,
      isActive: agreementForm.isActive,
      notes: agreementForm.notes || null,
    };

    const url = agreementMode === "create"
      ? "/api/investors/account-agreements"
      : `/api/investors/account-agreements/${agreementEditId}`;
    const method = agreementMode === "create" ? "POST" : "PATCH";
    setIsPending(true);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJsonResponse(res);
    setIsPending(false);
    if (!data.success) {
      setAgreementError(data.error ?? "فشل حفظ الاتفاق");
      return;
    }
    resetAgreementForm();
    router.refresh();
  }

  async function saveProfile() {
    setProfileError("");
    const payload = {
      companyId: props.companyId,
      investorId: props.investorId,
      branchId: profileForm.branchId || null,
      workersCount: Number(profileForm.workersCount || 0),
      monthlyAmount: Number(profileForm.monthlyAmount || 0),
      collectionStartDay: Number(profileForm.collectionStartDay || 22),
      collectionEndDay: Number(profileForm.collectionEndDay || 31),
      whatsappTemplateAr: profileForm.whatsappTemplateAr || null,
      whatsappTemplateEn: profileForm.whatsappTemplateEn || null,
      isActive: profileForm.isActive,
      notes: profileForm.notes || null,
    };

    const url = profileMode === "create"
      ? "/api/investors/salary-funding-profiles"
      : `/api/investors/salary-funding-profiles/${profileEditId}`;
    const method = profileMode === "create" ? "POST" : "PATCH";
    setIsPending(true);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJsonResponse(res);
    setIsPending(false);
    if (!data.success) {
      setProfileError(data.error ?? "فشل حفظ ملف تمويل الرواتب");
      return;
    }
    resetProfileForm();
    router.refresh();
  }

  async function createClaimFromAgreement(id: string) {
    setIsPending(true);
    const res = await fetch(`/api/investors/account-agreements/${id}/create-claim`, { method: "POST" });
    const data = await readJsonResponse(res);
    setIsPending(false);
    if (!data.success) {
      setAgreementError(data.error ?? "فشل إنشاء المطالبة");
      return;
    }
    router.push(`/dashboard/companies/${props.companyId}/investors/claims`);
    router.refresh();
  }

  const reminderMonth = new Date().getMonth() + 1;
  const reminderYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="إجمالي المطالبات" value={formatKWD(totals.actual)} tone="text-slate-900" />
        <StatCard label="المحصل من المطالبات" value={formatKWD(totals.collected)} tone="text-teal-700" />
        <StatCard label="المتبقي" value={formatKWD(totals.remaining)} tone="text-red-700" />
        <StatCard label="محصل تمويل الرواتب" value={formatKWD(totals.salaryCollected)} tone="text-indigo-700" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/companies/${props.companyId}/investors/accounts/${props.investorId}/print`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          <Printer size={15} />
          طباعة كشف الحساب
        </Link>
        <Link
          href={`/dashboard/companies/${props.companyId}/investors/claims?investorId=${props.investorId}`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          <Wallet size={15} />
          عرض المطالبات
        </Link>
        <Link
          href={`/dashboard/companies/${props.companyId}/investors/salaries?investorId=${props.investorId}`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          <Send size={15} />
          عرض تحصيلات الرواتب
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">الاتفاقيات المالية</h2>
            <button onClick={resetAgreementForm} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              <Plus size={15} />
              اتفاق جديد
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="عنوان الاتفاق">
              <input className="input-field w-full" value={agreementForm.titleAr} onChange={(e) => setAgreementForm((p) => ({ ...p, titleAr: e.target.value }))} />
            </Field>
            <Field label="العنوان الإنجليزي">
              <input className="input-field w-full" value={agreementForm.titleEn} onChange={(e) => setAgreementForm((p) => ({ ...p, titleEn: e.target.value }))} />
            </Field>
            <Field label="التصنيف">
              <select className="input-field w-full" value={agreementForm.chargeCategory} onChange={(e) => setAgreementForm((p) => ({ ...p, chargeCategory: e.target.value }))}>
                {chargeCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="نوع المطالبة">
              <select className="input-field w-full" value={agreementForm.claimType} onChange={(e) => setAgreementForm((p) => ({ ...p, claimType: e.target.value }))}>
                {claimTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="دورة الاستحقاق">
              <select className="input-field w-full" value={agreementForm.billingCycle} onChange={(e) => setAgreementForm((p) => ({ ...p, billingCycle: e.target.value }))}>
                {billingCycleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="المبلغ">
              <input type="number" step="0.001" className="input-field w-full" value={agreementForm.amount} onChange={(e) => setAgreementForm((p) => ({ ...p, amount: e.target.value }))} />
            </Field>
            <Field label="الفرع">
              <select className="input-field w-full" value={agreementForm.branchId} onChange={(e) => setAgreementForm((p) => ({ ...p, branchId: e.target.value }))}>
                <option value="">بدون فرع</option>
                {props.branches.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
              </select>
            </Field>
            <Field label="الترخيص">
              <select className="input-field w-full" value={agreementForm.licenseId} onChange={(e) => setAgreementForm((p) => ({ ...p, licenseId: e.target.value }))}>
                <option value="">بدون ترخيص</option>
                {props.licenses.map((item) => <option key={item.id} value={item.id}>{item.nameAr} - {item.licenseNumber}</option>)}
              </select>
            </Field>
            <Field label="الموظف المرتبط">
              <select className="input-field w-full" value={agreementForm.employeeId} onChange={(e) => setAgreementForm((p) => ({ ...p, employeeId: e.target.value }))}>
                <option value="">بدون موظف</option>
                {props.employees.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
              </select>
            </Field>
            <Field label="يوم الاستحقاق">
              <input type="number" min="1" max="31" className="input-field w-full" value={agreementForm.dueDay} onChange={(e) => setAgreementForm((p) => ({ ...p, dueDay: e.target.value }))} />
            </Field>
            <Field label="شهر الاستحقاق السنوي">
              <input type="number" min="1" max="12" className="input-field w-full" value={agreementForm.dueMonth} onChange={(e) => setAgreementForm((p) => ({ ...p, dueMonth: e.target.value }))} />
            </Field>
            <Field label="تاريخ البداية">
              <input type="date" className="input-field w-full" value={agreementForm.startDate} onChange={(e) => setAgreementForm((p) => ({ ...p, startDate: e.target.value }))} />
            </Field>
            <Field label="الاستحقاق القادم">
              <input type="date" className="input-field w-full" value={agreementForm.nextDueDate} onChange={(e) => setAgreementForm((p) => ({ ...p, nextDueDate: e.target.value }))} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agreementForm.autoCreateClaim} onChange={(e) => setAgreementForm((p) => ({ ...p, autoCreateClaim: e.target.checked }))} />
              إنشاء مطالبة تلقائيًا عند استخدام الجدولة لاحقًا
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agreementForm.isActive} onChange={(e) => setAgreementForm((p) => ({ ...p, isActive: e.target.checked }))} />
              الاتفاق نشط
            </label>
            <textarea className="input-field w-full" rows={3} placeholder="ملاحظات" value={agreementForm.notes} onChange={(e) => setAgreementForm((p) => ({ ...p, notes: e.target.value }))} />
            {agreementError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{agreementError}</p>}
            <div className="flex gap-2">
              <button onClick={saveAgreement} disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {agreementMode === "create" ? "حفظ الاتفاق" : "حفظ التعديل"}
              </button>
              {agreementMode === "edit" && (
                <button onClick={resetAgreementForm} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>الاتفاق</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الاستحقاق القادم</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {props.agreements.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد اتفاقيات مالية</td></tr>
                ) : props.agreements.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium">{item.titleAr}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.branch?.nameAr ?? "بدون فرع"}
                        {item.license ? ` • ${item.license.licenseNumber}` : ""}
                        {item.employee ? ` • ${item.employee.nameAr}` : ""}
                      </div>
                    </td>
                    <td className="text-sm">{claimTypeOptions.find((opt) => opt.value === item.claimType)?.label ?? item.claimType}</td>
                    <td className="number">{formatKWD(item.amount)}</td>
                    <td className="text-sm">{item.nextDueDate ? formatDate(item.nextDueDate) : "—"}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {item.isActive ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => createClaimFromAgreement(item.id)} className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50" title="إنشاء مطالبة">
                          <Send size={14} />
                        </button>
                        <button onClick={() => editAgreement(item)} className="rounded p-1.5 hover:bg-muted" title="تعديل">
                          <Pencil size={14} />
                        </button>
                        <DeleteConfirmButton apiUrl={`/api/investors/account-agreements/${item.id}`} confirmMessage={`حذف الاتفاق ${item.titleAr}؟`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">تمويل الرواتب ورسائل واتساب</h2>
            <button onClick={resetProfileForm} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              <Plus size={15} />
              ملف تمويل جديد
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="الفرع">
              <select className="input-field w-full" value={profileForm.branchId} onChange={(e) => setProfileForm((p) => ({ ...p, branchId: e.target.value }))}>
                <option value="">بدون فرع</option>
                {props.branches.map((item) => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
              </select>
            </Field>
            <Field label="عدد العمال">
              <input type="number" min="0" className="input-field w-full" value={profileForm.workersCount} onChange={(e) => setProfileForm((p) => ({ ...p, workersCount: e.target.value }))} />
            </Field>
            <Field label="المبلغ الشهري">
              <input type="number" step="0.001" min="0" className="input-field w-full" value={profileForm.monthlyAmount} onChange={(e) => setProfileForm((p) => ({ ...p, monthlyAmount: e.target.value }))} />
            </Field>
            <Field label="بداية التحصيل">
              <input type="number" min="1" max="31" className="input-field w-full" value={profileForm.collectionStartDay} onChange={(e) => setProfileForm((p) => ({ ...p, collectionStartDay: e.target.value }))} />
            </Field>
            <Field label="نهاية التحصيل">
              <input type="number" min="1" max="31" className="input-field w-full" value={profileForm.collectionEndDay} onChange={(e) => setProfileForm((p) => ({ ...p, collectionEndDay: e.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="قالب واتساب عربي">
                <textarea className="input-field w-full" rows={3} value={profileForm.whatsappTemplateAr} onChange={(e) => setProfileForm((p) => ({ ...p, whatsappTemplateAr: e.target.value }))} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="قالب واتساب إنجليزي">
                <textarea className="input-field w-full" rows={3} value={profileForm.whatsappTemplateEn} onChange={(e) => setProfileForm((p) => ({ ...p, whatsappTemplateEn: e.target.value }))} />
              </Field>
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={profileForm.isActive} onChange={(e) => setProfileForm((p) => ({ ...p, isActive: e.target.checked }))} />
              الملف نشط
            </label>
            <textarea className="input-field w-full" rows={3} placeholder="ملاحظات" value={profileForm.notes} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} />
            {profileError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{profileError}</p>}
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {profileMode === "create" ? "حفظ ملف التمويل" : "حفظ التعديل"}
              </button>
              {profileMode === "edit" && (
                <button onClick={resetProfileForm} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>الفرع</th>
                  <th>عدد العمال</th>
                  <th>المبلغ الشهري</th>
                  <th>دورة التحصيل</th>
                  <th>واتساب</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {props.salaryProfiles.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد ملفات تمويل رواتب</td></tr>
                ) : props.salaryProfiles.map((item) => {
                  const messageAr = buildInvestorSalaryFundingReminder({
                    locale: "ar",
                    investorName: props.investorName,
                    month: reminderMonth,
                    year: reminderYear,
                    workersCount: item.workersCount,
                    amount: toNumber(item.monthlyAmount),
                    customTemplate: item.whatsappTemplateAr,
                  });
                  const messageEn = buildInvestorSalaryFundingReminder({
                    locale: "en",
                    investorName: props.investorName,
                    month: reminderMonth,
                    year: reminderYear,
                    workersCount: item.workersCount,
                    amount: toNumber(item.monthlyAmount),
                    customTemplate: item.whatsappTemplateEn,
                  });
                  return (
                    <tr key={item.id}>
                      <td>{item.branch?.nameAr ?? "بدون فرع"}</td>
                      <td>{item.workersCount}</td>
                      <td className="number">{formatKWD(item.monthlyAmount)}</td>
                      <td>{item.collectionStartDay} - {item.collectionEndDay}</td>
                      <td>
                        {props.investorPhone ? (
                          <div className="flex items-center gap-1">
                            <a href={buildWhatsAppUrl(props.investorPhone, messageAr)} target="_blank" className="rounded p-1.5 text-green-700 hover:bg-green-50" title="رسالة عربي">
                              <MessageCircle size={14} />
                            </a>
                            <a href={buildWhatsAppUrl(props.investorPhone, messageEn)} target="_blank" className="rounded p-1.5 text-blue-700 hover:bg-blue-50" title="رسالة English">
                              <MessageCircle size={14} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">لا يوجد رقم واتساب</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => editProfile(item)} className="rounded p-1.5 hover:bg-muted" title="تعديل">
                            <Pencil size={14} />
                          </button>
                          <DeleteConfirmButton apiUrl={`/api/investors/salary-funding-profiles/${item.id}`} confirmMessage="حذف ملف تمويل الرواتب؟" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-base font-bold">أحدث المطالبات</h2>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>البيان</th>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>المحصل</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {props.claims.slice(0, 6).map((claim) => {
                  const actual = claim.lines.reduce((sum, line) => sum + toNumber(line.actualAmount), 0);
                  const collected = claim.lines.reduce((sum, line) => sum + toNumber(line.collectedAmount), 0);
                  return (
                    <tr key={claim.id}>
                      <td className="max-w-64 truncate">{claim.descriptionAr}</td>
                      <td>{formatDate(claim.claimDate)}</td>
                      <td className="number">{formatKWD(actual)}</td>
                      <td className="number">{formatKWD(collected)}</td>
                      <td><span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(claim.status)}`}>{claim.status}</span></td>
                    </tr>
                  );
                })}
                {props.claims.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد مطالبات</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-base font-bold">أحدث تحصيلات تمويل الرواتب</h2>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th>تاريخ التحصيل</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {props.salaryCollections.slice(0, 6).map((item) => (
                  <tr key={item.id}>
                    <td>{formatMonthYear(item.month, item.year)}</td>
                    <td>{formatDate(item.collectedDate)}</td>
                    <td className="number">{formatKWD(item.collectedAmount)}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}>{item.status}</span></td>
                  </tr>
                ))}
                {props.salaryCollections.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد تحصيلات رواتب</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
