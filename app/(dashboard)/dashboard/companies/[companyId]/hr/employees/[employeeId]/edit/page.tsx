"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Save, ChevronDown, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { allowsCrossCompanyLicenses } from "@/lib/hr/company-employee-rules";

interface SearchableOption { id: string; label: string; sub?: string }

interface CompanyLookup {
  type: string;
}

function SearchableSelect({
  options, value, onChange, placeholder,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); setQuery(""); }}
        className="input-field w-full flex items-center justify-between text-right"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sub && <span className="mr-1 text-xs text-muted-foreground">— {selected.sub}</span>}
            </span>
          ) : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && (
            <span onClick={(e) => { e.stopPropagation(); onChange(""); }} className="rounded p-0.5 hover:bg-muted">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" />
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg" style={{ maxHeight: "260px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="border-b p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم الموحد..."
              className="w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              dir="rtl"
            />
          </div>
          <div className="overflow-y-auto">
            <button type="button" className="w-full px-3 py-2 text-right text-sm text-muted-foreground hover:bg-muted" onClick={() => { onChange(""); setOpen(false); }}>
              — {placeholder} —
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">لا توجد نتائج</p>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`w-full px-3 py-2 text-right text-sm hover:bg-muted ${o.id === value ? "bg-primary/10 font-medium text-primary" : ""}`}
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
              >
                <span>{o.label}</span>
                {o.sub && <span className="mr-2 text-xs text-muted-foreground">{o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const employeeTypes = {
  ar: [
    { value: "DRIVER", label: "سائق" },
    { value: "DELIVERY_DRIVER", label: "سائق توصيل" },
    { value: "DELIVERY_ADMIN", label: "إداري توصيل" },
    { value: "CAR_WASH_DRIVER", label: "سائق غسيل" },
    { value: "CAR_WASH_WORKER", label: "عامل غسيل" },
    { value: "OFFICE_EMPLOYEE", label: "موظف مكتب" },
    { value: "ACCOUNTANT", label: "محاسب" },
    { value: "MANDOUB", label: "مندوب" },
    { value: "OFFICE_BOY", label: "عامل خدمات" },
    { value: "OTHER", label: "أخرى" },
  ],
  en: [
    { value: "DRIVER", label: "Driver" },
    { value: "DELIVERY_DRIVER", label: "Delivery Driver" },
    { value: "DELIVERY_ADMIN", label: "Delivery Admin" },
    { value: "CAR_WASH_DRIVER", label: "Car Wash Driver" },
    { value: "CAR_WASH_WORKER", label: "Car Wash Worker" },
    { value: "OFFICE_EMPLOYEE", label: "Office Employee" },
    { value: "ACCOUNTANT", label: "Accountant" },
    { value: "MANDOUB", label: "Mandoub" },
    { value: "OFFICE_BOY", label: "Office Boy" },
    { value: "OTHER", label: "Other" },
  ],
} as const;

interface FormState {
  employeeNumber: string;
  nameAr: string;
  nameEn: string;
  type: string;
  branchId: string;
  licenseId: string;
  nationality: string;
  civilId: string;
  passportNumber: string;
  residencyNumber: string;
  residencyExpiry: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone: string;
  joinDate: string;
  baseSalary: string;
  bankAccountNumber: string;
  notes: string;
  isActive: boolean;
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams<{ companyId: string; employeeId: string }>();
  const { companyId, employeeId } = params;
  const { locale } = useLocale();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [companyType, setCompanyType] = useState("OTHER");
  const [branches, setBranches] = useState<{ id: string; nameAr: string; nameEn?: string | null; unifiedEntityNumber?: string | null }[]>([]);
  const [licenses, setLicenses] = useState<{ id: string; commercialNameAr: string; licenseNumber: string; unifiedEntityNumber?: string | null }[]>([]);
  const [groupLicenses, setGroupLicenses] = useState<{ id: string; commercialNameAr: string; licenseNumber: string; unifiedEntityNumber?: string | null; company?: { nameAr: string } }[]>([]);
  const [additionalLicenseIds, setAdditionalLicenseIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    employeeNumber: "",
    nameAr: "",
    nameEn: "",
    type: "OFFICE_EMPLOYEE",
    branchId: "",
    licenseId: "",
    nationality: "",
    civilId: "",
    passportNumber: "",
    residencyNumber: "",
    residencyExpiry: "",
    licenseNumber: "",
    licenseExpiry: "",
    phone: "",
    joinDate: "",
    baseSalary: "",
    bankAccountNumber: "",
    notes: "",
    isActive: true,
  });
  const showAdditionalLicenses = allowsCrossCompanyLicenses(companyType);

  const load = useCallback(async () => {
    try {
      const [employeeRes, companyRes, branchesRes, licensesRes, groupRes] = await Promise.all([
        fetch(`/api/hr/employees/${employeeId}`),
        fetch(`/api/companies/${companyId}`),
        fetch(`/api/companies/${companyId}/branches`),
        fetch(`/api/licenses?companyId=${companyId}`),
        fetch(`/api/licenses?groupWide=true&excludeCompanyId=${companyId}`),
      ]);
      const employeePayload = await employeeRes.json();
      const companyPayload = await companyRes.json();
      const branchesPayload = await branchesRes.json();
      const licensesPayload = await licensesRes.json();
      const groupPayload = await groupRes.json();

      if (companyPayload.success) setCompanyType((companyPayload.data as CompanyLookup).type);
      if (branchesPayload.success) setBranches(branchesPayload.data);
      if (licensesPayload.success) setLicenses(licensesPayload.data);
      if (groupPayload.success) setGroupLicenses(groupPayload.data);

      if (employeePayload.success) {
        const e = employeePayload.data;
        // تحميل التراخيص الإضافية المحفوظة
        if (e.licenseAssignments?.length) {
          setAdditionalLicenseIds(e.licenseAssignments.map((a: { licenseId: string }) => a.licenseId));
        }
        setForm({
          employeeNumber: e.employeeNumber ?? "",
          nameAr: e.nameAr ?? "",
          nameEn: e.nameEn ?? "",
          type: e.type ?? "OFFICE_EMPLOYEE",
          branchId: e.branchId ?? "",
          licenseId: e.licenseId ?? "",
          nationality: e.nationality ?? "",
          civilId: e.civilId ?? "",
          passportNumber: e.passportNumber ?? "",
          residencyNumber: e.residencyNumber ?? "",
          residencyExpiry: toInputDate(e.residencyExpiry),
          licenseNumber: e.licenseNumber ?? "",
          licenseExpiry: toInputDate(e.licenseExpiry),
          phone: e.phone ?? "",
          joinDate: toInputDate(e.joinDate),
          baseSalary: e.baseSalary != null ? String(e.baseSalary) : "",
          bankAccountNumber: e.bankAccountNumber ?? "",
          notes: e.notes ?? "",
          isActive: e.isActive ?? true,
        });
      } else {
        setError(locale === "en" ? "Employee not found" : "الموظف غير موجود");
      }
    } catch {
      setError(locale === "en" ? "Failed to load employee data" : "تعذر تحميل بيانات الموظف");
    } finally {
      setFetching(false);
    }
  }, [employeeId, companyId, locale]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/hr/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNumber: form.employeeNumber || undefined,
          nameAr: form.nameAr,
          nameEn: form.nameEn || undefined,
          branchId: form.branchId || null,
          licenseId: form.licenseId || null,
          additionalLicenseIds: showAdditionalLicenses ? additionalLicenseIds : [],
          nationality: form.nationality || undefined,
          civilId: form.civilId || undefined,
          passportNumber: form.passportNumber || undefined,
          residencyNumber: form.residencyNumber || undefined,
          residencyExpiry: form.residencyExpiry || undefined,
          licenseNumber: form.licenseNumber || undefined,
          licenseExpiry: form.licenseExpiry || undefined,
          phone: form.phone || undefined,
          joinDate: form.joinDate || undefined,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          notes: form.notes || undefined,
          isActive: form.isActive,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Failed to save" : "فشل في الحفظ"));
      router.push(`/dashboard/companies/${companyId}/hr/employees/${employeeId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">{locale === "en" ? "Loading..." : "جاري التحميل..."}</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "Edit Employee" : "تعديل بيانات الموظف"}
        subtitle={form.nameAr}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/employees/${employeeId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {locale === "en" ? "Back to employee" : "العودة لملف الموظف"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Basic information" : "البيانات الأساسية"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Employee code" : "رقم الموظف"}
                </label>
                <input
                  type="text"
                  value={form.employeeNumber}
                  onChange={(e) => setField("employeeNumber", e.target.value)}
                  className="input-field w-full"
                  placeholder="EMP-001"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Branch" : "الفرع"}
                </label>
                <SearchableSelect
                  value={form.branchId}
                  onChange={(id) => setField("branchId", id)}
                  placeholder={locale === "en" ? "Select branch" : "اختر الفرع"}
                  options={branches.map((b) => ({
                    id: b.id,
                    label: locale === "en" ? (b.nameEn ?? b.nameAr) : b.nameAr,
                    sub: b.unifiedEntityNumber ?? undefined,
                  }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "License" : "الترخيص"}
                </label>
                <SearchableSelect
                  value={form.licenseId}
                  onChange={(id) => setField("licenseId", id)}
                  placeholder={locale === "en" ? "Select license" : "اختر الترخيص"}
                  options={licenses.map((l) => ({
                    id: l.id,
                    label: `${l.commercialNameAr} (${l.licenseNumber})`,
                    sub: l.unifiedEntityNumber ?? undefined,
                  }))}
                />
              </div>
              {showAdditionalLicenses && (
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    {locale === "en" ? "Additional licenses (cross-company admin)" : "تراخيص إضافية (إداري عابر للشركات)"}
                  </label>
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {additionalLicenseIds.map((licenseId) => {
                        const license = groupLicenses.find((item) => item.id === licenseId);
                        if (!license) return null;

                        return (
                          <span key={licenseId} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {license.commercialNameAr} ({license.licenseNumber})
                            <button
                              type="button"
                              onClick={() => setAdditionalLicenseIds((previous) => previous.filter((item) => item !== licenseId))}
                              className="hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      {additionalLicenseIds.length === 0 && (
                        <p className="text-xs text-muted-foreground">{locale === "en" ? "No additional licenses" : "لا توجد تراخيص إضافية"}</p>
                      )}
                    </div>
                    <select
                      className="input-field w-full text-sm"
                      value=""
                      onChange={(event) => {
                        const nextLicenseId = event.target.value;
                        if (nextLicenseId && !additionalLicenseIds.includes(nextLicenseId)) {
                          setAdditionalLicenseIds((previous) => [...previous, nextLicenseId]);
                        }
                      }}
                    >
                      <option value="">{locale === "en" ? "— Add license from another company —" : "— أضف ترخيصاً من شركة أخرى —"}</option>
                      {groupLicenses
                        .filter((license) => !additionalLicenseIds.includes(license.id))
                        .map((license) => (
                          <option key={license.id} value={license.id}>
                            {license.company?.nameAr ? `[${license.company.nameAr}] ` : ""}
                            {license.commercialNameAr} ({license.licenseNumber})
                            {license.unifiedEntityNumber ? ` — ${license.unifiedEntityNumber}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Arabic name" : "الاسم بالعربي"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nameAr}
                  onChange={(e) => setField("nameAr", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "English name" : "الاسم بالإنجليزي"}
                </label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(e) => setField("nameEn", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Employee type" : "الوظيفة"}
                </label>
                <select
                  value={form.type}
                  disabled
                  className="input-field w-full cursor-not-allowed opacity-60"
                  title={locale === "en" ? "Type cannot be changed after creation" : "لا يمكن تغيير النوع بعد الإنشاء"}
                >
                  {employeeTypes[locale].map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === "en" ? "Type cannot be changed after creation." : "لا يمكن تغيير نوع الموظف بعد الإنشاء."}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Nationality" : "الجنسية"}
                </label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => setField("nationality", e.target.value)}
                  className="input-field w-full"
                  placeholder={locale === "en" ? "Example: Egyptian, Indian" : "مثال: مصري، هندي"}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Phone number" : "رقم الهاتف"}
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className="input-field w-full"
                  placeholder="+965XXXXXXXX"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Joining date" : "تاريخ الالتحاق"}
                </label>
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setField("joinDate", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Base salary (KWD)" : "الراتب الأساسي (د.ك)"}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.baseSalary}
                  onChange={(e) => setField("baseSalary", e.target.value)}
                  className="input-field w-full"
                  placeholder="0.000"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setField("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {locale === "en" ? "Active employee" : "موظف نشط"}
                </label>
              </div>
            </div>
          </div>

          {/* Identity & Documents */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Identity and documents" : "الوثائق والهوية"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Civil ID" : "رقم البطاقة المدنية"}
                </label>
                <input
                  type="text"
                  value={form.civilId}
                  onChange={(e) => setField("civilId", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Passport number" : "رقم الجواز"}
                </label>
                <input
                  type="text"
                  value={form.passportNumber}
                  onChange={(e) => setField("passportNumber", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Residency number" : "رقم الإقامة"}
                </label>
                <input
                  type="text"
                  value={form.residencyNumber}
                  onChange={(e) => setField("residencyNumber", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Residency expiry date" : "تاريخ انتهاء الإقامة"}
                </label>
                <input
                  type="date"
                  value={form.residencyExpiry}
                  onChange={(e) => setField("residencyExpiry", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Driving license number" : "رقم الرخصة"}
                </label>
                <input
                  type="text"
                  value={form.licenseNumber}
                  onChange={(e) => setField("licenseNumber", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Driving license expiry" : "تاريخ انتهاء الرخصة"}
                </label>
                <input
                  type="date"
                  value={form.licenseExpiry}
                  onChange={(e) => setField("licenseExpiry", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Bank account number" : "رقم الحساب البنكي"}
                </label>
                <input
                  type="text"
                  value={form.bankAccountNumber}
                  onChange={(e) => setField("bankAccountNumber", e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {locale === "en" ? "Notes" : "ملاحظات"}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              className="input-field w-full resize-none"
              placeholder={locale === "en" ? "Any additional notes..." : "أي ملاحظات إضافية..."}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading
                ? locale === "en" ? "Saving..." : "جاري الحفظ..."
                : locale === "en" ? "Save changes" : "حفظ التعديلات"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/hr/employees/${employeeId}`}
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
