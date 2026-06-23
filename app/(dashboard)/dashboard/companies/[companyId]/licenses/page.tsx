"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Printer, Search, ChevronDown } from "lucide-react";
import { Header } from "@/components/layout/header";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Investor  { id: string; nameAr: string }
interface License {
  id: string;
  commercialNameAr: string;
  commercialNameEn?: string | null;
  licenseNumber: string;
  isMainLicense: boolean;
  mainLicenseId?: string | null;
  status: string;
  issueDate?: string | null;
  licenseExpiryDate?: string | null;
  fireLicenseExpiryDate?: string | null;
  healthLicenseExpiryDate?: string | null;
  advertisingLicenseExpiryDate?: string | null;
  investorId?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  unifiedEntityNumber?: string | null;
  civilEntityNumber?: string | null;
  notes?: string | null;
  investor?: { nameAr: string } | null;
  mainLicense?: { id: string; commercialNameAr: string; licenseNumber: string } | null;
  _count: { employees: number; branchLicenses: number };
}

const EMPTY = {
  commercialNameAr: "", commercialNameEn: "", licenseNumber: "",
  isMainLicense: true, mainLicenseId: "",
  status: "ACTIVE",
  issueDate: "", licenseExpiryDate: "",
  fireLicenseExpiryDate: "", healthLicenseExpiryDate: "", advertisingLicenseExpiryDate: "",
  investorId: "",
  managerName: "", managerPhone: "",
  unifiedEntityNumber: "", civilEntityNumber: "",
  legalEntity: "", capital: "", commercialRegNo: "",
  notes: "",
};
type Form = typeof EMPTY;

// الحالات المُستبعدة من الإحصائيات (ملغاة لا تُحسب إطلاقاً)
const EXCLUDED_STATUSES = new Set(["CANCELLED"]);

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "فعال",
  EXPIRED:   "منتهي",
  SUSPENDED: "موقوف",
  CANCELLED: "ملغاة",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  EXPIRED:   "bg-red-100 text-red-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-KW");
}

function ExpiryCell({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const days = daysLeft(date);
  const label = new Date(date).toLocaleDateString("ar-KW");
  if (days === null) return <span>{label}</span>;
  if (days < 0)   return <span className="text-red-700 font-semibold">{label}</span>;
  if (days <= 30) return <span className="text-red-600 font-medium">{label} <span className="text-[10px]">({days})</span></span>;
  if (days <= 90) return <span className="text-orange-500 font-medium">{label}</span>;
  return <span>{label}</span>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, wide, onClose, children }: {
  title: string; wide?: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LicensesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [licenses,  setLicenses]  = useState<License[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState<Form>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleteError,setDeleteError]= useState("");
  const [deleting,   setDeleting]   = useState(false);

  // ── Status change ─────────────────────────────────────────────────────────
  const [statusModal,   setStatusModal]   = useState<{ id: string; current: string; name: string } | null>(null);
  const [newStatus,     setNewStatus]     = useState("");
  const [statusSaving,  setStatusSaving]  = useState(false);
  const [statusError,   setStatusError]   = useState("");

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterType,     setFilterType]     = useState("");   // "" | "main" | "branch"
  const [filterInvestor, setFilterInvestor] = useState("");
  const [filterExpiry,   setFilterExpiry]   = useState("");   // "" | "expired" | "30" | "60" | "90"

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      fetch(`/api/licenses?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()),
    ]);
    if (a.success) setLicenses(a.data);
    if (c.success) setInvestors(c.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // ── Computed stats (exclude CANCELLED) ──────────────────────────────────────
  const activeLicenses    = licenses.filter((l) => !EXCLUDED_STATUSES.has(l.status));
  const activeMainCount   = activeLicenses.filter((l) =>  l.isMainLicense).length;
  const activeSubCount    = activeLicenses.filter((l) => !l.isMainLicense).length;
  const expiringSoon      = activeLicenses.filter((l) => {
    const dates = [l.licenseExpiryDate, l.fireLicenseExpiryDate, l.healthLicenseExpiryDate, l.advertisingLicenseExpiryDate];
    return dates.some((d) => { const n = daysLeft(d); return n !== null && n >= 0 && n <= 90; });
  }).length;

  // Active branch count per main license (excluding CANCELLED branches)
  function activeBranchCount(licId: string) {
    return activeLicenses.filter((l) => !l.isMainLicense && l.mainLicenseId === licId).length;
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = licenses.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (!l.commercialNameAr.toLowerCase().includes(q) && !l.licenseNumber.toLowerCase().includes(q)) return false;
    }
    if (filterStatus   && l.status    !== filterStatus)  return false;
    if (filterType === "main"   && !l.isMainLicense)     return false;
    if (filterType === "branch" &&  l.isMainLicense)     return false;
    if (filterInvestor && l.investorId !== filterInvestor) return false;
    if (filterExpiry) {
      const allDates = [l.licenseExpiryDate, l.fireLicenseExpiryDate, l.healthLicenseExpiryDate, l.advertisingLicenseExpiryDate];
      if (filterExpiry === "expired") {
        return allDates.some((d) => { const n = daysLeft(d); return n !== null && n < 0; });
      }
      const max = Number(filterExpiry);
      return allDates.some((d) => { const n = daysLeft(d); return n !== null && n >= 0 && n <= max; });
    }
    return true;
  });

  const mainLicensesForForm = licenses.filter((l) => l.isMainLicense);
  const hasFilters = !!(search || filterStatus || filterType || filterInvestor || filterExpiry);

  function clearFilters() {
    setSearch(""); setFilterStatus(""); setFilterType("");
    setFilterInvestor(""); setFilterExpiry("");
  }

  // ── Filter summary for print header ──────────────────────────────────────
  const filterParts: string[] = [];
  if (search)         filterParts.push(`بحث: "${search}"`);
  if (filterStatus)   filterParts.push(`الحالة: ${STATUS_LABELS[filterStatus] ?? filterStatus}`);
  if (filterType === "main")   filterParts.push("النوع: رئيسية فقط");
  if (filterType === "branch") filterParts.push("النوع: فرعية فقط");
  if (filterInvestor) filterParts.push(`المسئول: ${investors.find((i) => i.id === filterInvestor)?.nameAr ?? ""}`);
  if (filterExpiry === "expired")    filterParts.push("منتهية الصلاحية");
  else if (filterExpiry)             filterParts.push(`تنتهي خلال ${filterExpiry} يوم`);

  // ── Form helpers ─────────────────────────────────────────────────────────
  function f<K extends keyof Form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }
  function openAdd() { setForm(EMPTY); setFormError(""); setShowForm(true); }

  async function save() {
    if (!form.commercialNameAr.trim()) { setFormError("الاسم التجاري مطلوب"); return; }
    if (!form.licenseNumber.trim())    { setFormError("رقم الترخيص مطلوب"); return; }
    if (!form.isMainLicense && !form.mainLicenseId) { setFormError("يجب اختيار الترخيص الرئيسي"); return; }
    setSaving(true); setFormError("");
    const body = {
      companyId, ...form,
      investorId: form.investorId || null,
      mainLicenseId: form.isMainLicense ? null : (form.mainLicenseId || null),
      issueDate:                    form.issueDate                    || null,
      licenseExpiryDate:            form.licenseExpiryDate            || null,
      fireLicenseExpiryDate:        form.fireLicenseExpiryDate        || null,
      healthLicenseExpiryDate:      form.healthLicenseExpiryDate      || null,
      advertisingLicenseExpiryDate: form.advertisingLicenseExpiryDate || null,
      managerName: form.managerName || null, managerPhone: form.managerPhone || null,
      unifiedEntityNumber: form.unifiedEntityNumber || null,
      civilEntityNumber:   form.civilEntityNumber   || null,
      legalEntity: form.legalEntity || null,
      capital:     form.capital ? Number(form.capital) : null,
      commercialRegNo: form.commercialRegNo || null,
      notes: form.notes || null,
    };
    const res  = await fetch("/api/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    router.push(`/dashboard/companies/${companyId}/licenses/${data.data.id}`);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError("");
    const res  = await fetch(`/api/licenses/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    setDeleteId(null); load();
  }

  async function confirmStatusChange() {
    if (!statusModal || !newStatus || newStatus === statusModal.current) return;
    setStatusSaving(true); setStatusError("");
    const res = await fetch(`/api/licenses/${statusModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setStatusSaving(false);
    if (!data.success) { setStatusError(data.error ?? "فشل تغيير الحالة"); return; }
    setStatusModal(null);
    load();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Header
        title="التراخيص"
        subtitle="إدارة التراخيص الرئيسية والفرعية"
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              <Printer size={14} /> طباعة التقرير
            </button>
            <button onClick={openAdd} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
              + إضافة ترخيص
            </button>
          </div>
        }
      />

      <div className="page-container space-y-4">

        {/* ── Print-only header ────────────────────────────────────────────── */}
        <div className="print-only border-b border-gray-300 pb-3 mb-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold">تقرير التراخيص</h1>
              {filterParts.length > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">الفلاتر: {filterParts.join(" · ")}</p>
              )}
            </div>
            <div className="text-left text-xs text-gray-500">
              <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-KW")}</p>
              <p>إجمالي النتائج: {filtered.length} ترخيص</p>
            </div>
          </div>
        </div>

        {/* ── Stats (screen only) ───────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 no-print">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي التراخيص الفعالة</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{activeLicenses.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">تراخيص رئيسية فعالة</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeMainCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">تراخيص فرعية فعالة</p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{activeSubCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">تنتهي خلال 90 يوم</p>
            <p className={`mt-1 text-2xl font-bold ${expiringSoon > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
              {expiringSoon}
            </p>
          </div>
        </div>

        {/* ── Filters bar (screen only) ─────────────────────────────────────── */}
        <div className="section-card no-print space-y-3">
          <div className="flex items-center flex-wrap gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الترخيص..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full pr-8 text-sm"
              />
            </div>

            {/* Status */}
            <select className="input-field text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="ACTIVE">فعال</option>
              <option value="EXPIRED">منتهي</option>
              <option value="SUSPENDED">موقوف</option>
              <option value="CANCELLED">ملغاة</option>
            </select>

            {/* Type */}
            <select className="input-field text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">كل الأنواع</option>
              <option value="main">رئيسية فقط</option>
              <option value="branch">فرعية فقط</option>
            </select>

            {/* Investor */}
            {investors.length > 0 && (
              <select className="input-field text-sm" value={filterInvestor} onChange={(e) => setFilterInvestor(e.target.value)}>
                <option value="">كل المسئولين</option>
                {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
              </select>
            )}

            {/* Expiry */}
            <select className="input-field text-sm" value={filterExpiry} onChange={(e) => setFilterExpiry(e.target.value)}>
              <option value="">كل التواريخ</option>
              <option value="expired">منتهية الصلاحية</option>
              <option value="30">تنتهي خلال 30 يوم</option>
              <option value="60">تنتهي خلال 60 يوم</option>
              <option value="90">تنتهي خلال 90 يوم</option>
            </select>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-2 py-1.5"
              >
                <X size={12} /> مسح الفلاتر
              </button>
            )}
          </div>

          {/* Result count */}
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              يُعرض <span className="font-semibold text-foreground">{filtered.length}</span> من {licenses.length} ترخيص
            </p>
          )}
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th className="no-print">#</th>
                    <th>الاسم التجاري</th>
                    <th>رقم الترخيص</th>
                    <th>النوع</th>
                    <th>الترخيص الرئيسي</th>
                    <th>المسئول والمدير</th>
                    <th>انتهاء الترخيص</th>
                    <th>انتهاء الإطفاء</th>
                    <th>انتهاء الصحة</th>
                    <th className="text-center">موظفون</th>
                    <th className="text-center">تراخيص فرعية</th>
                    <th>الحالة</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-muted-foreground">
                        {hasFilters ? "لا توجد نتائج تطابق الفلاتر المحددة" : "لا توجد تراخيص — اضغط \"إضافة ترخيص\" للبدء"}
                      </td>
                    </tr>
                  ) : filtered.map((lic, idx) => (
                    <tr
                      key={lic.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${lic.id}`)}
                    >
                      <td className="text-muted-foreground text-xs no-print">{idx + 1}</td>
                      <td className="font-medium">
                        {!lic.isMainLicense && (
                          <span className="mr-1 inline-block h-3 w-0.5 rounded bg-blue-400" />
                        )}
                        {lic.commercialNameAr}
                        {!lic.isMainLicense && (
                          <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">فرعي</span>
                        )}
                      </td>
                      <td className="font-mono text-sm">{lic.licenseNumber}</td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          lic.isMainLicense ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {lic.isMainLicense ? "رئيسي" : "فرعي"}
                        </span>
                      </td>
                      <td className="text-sm">
                        {lic.mainLicense
                          ? <span className="text-blue-600">{lic.mainLicense.commercialNameAr}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>{lic.investor?.nameAr   ?? <span className="text-muted-foreground">—</span>}</td>
                      <td><ExpiryCell date={lic.licenseExpiryDate} /></td>
                      <td><ExpiryCell date={lic.fireLicenseExpiryDate} /></td>
                      <td><ExpiryCell date={lic.healthLicenseExpiryDate} /></td>
                      <td className="text-center">{lic._count.employees}</td>
                      <td className="text-center">
                        {lic.isMainLicense
                          ? (() => {
                              const cnt = activeBranchCount(lic.id);
                              return <span className={cnt > 0 ? "font-bold text-blue-600" : "text-muted-foreground"}>{cnt}</span>;
                            })()
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lic.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[lic.status] ?? lic.status}
                        </span>
                      </td>
                      <td className="no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => {
                              setStatusModal({ id: lic.id, current: lic.status, name: lic.commercialNameAr });
                              setNewStatus(lic.status);
                              setStatusError("");
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                          >
                            <ChevronDown size={11} />
                            الحالة
                          </button>
                          <button
                            onClick={() => { setDeleteId(lic.id); setDeleteError(""); }}
                            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Print footer summary */}
                {filtered.length > 0 && (
                  <tfoot className="print-only">
                    <tr className="border-t-2 border-gray-400 font-semibold text-sm">
                      <td colSpan={9} className="py-2 text-right">الإجمالي</td>
                      <td className="text-center py-2">{filtered.reduce((s, l) => s + l._count.employees, 0)}</td>
                      <td className="text-center py-2">
                        {filtered.filter((l) => l.isMainLicense).reduce((s, l) => s + activeBranchCount(l.id), 0)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      {showForm && (
        <Modal title="إضافة ترخيص جديد" wide onClose={() => setShowForm(false)}>
          <div className="space-y-5">

            {/* النوع */}
            <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, isMainLicense: true, mainLicenseId: "" }))}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${form.isMainLicense ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >ترخيص رئيسي</button>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, isMainLicense: false }))}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${form.isMainLicense ? "text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground shadow-sm"}`}
              >ترخيص فرعي</button>
            </div>

            {/* الترخيص الرئيسي */}
            {!form.isMainLicense && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <label className="form-label text-blue-700">الترخيص الرئيسي *</label>
                <select className="input-field" value={form.mainLicenseId} onChange={f("mainLicenseId")}>
                  <option value="">— اختر الترخيص الرئيسي —</option>
                  {mainLicensesForForm.map((l) => (
                    <option key={l.id} value={l.id}>{l.commercialNameAr} ({l.licenseNumber})</option>
                  ))}
                </select>
              </div>
            )}

            {/* البيانات الأساسية */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">البيانات الأساسية</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">الاسم التجاري (عربي) *</label>
                  <input className="input-field" placeholder="مثال: مطعم الراشد" value={form.commercialNameAr} onChange={f("commercialNameAr")} /></div>
                <div><label className="form-label">الاسم التجاري (إنجليزي)</label>
                  <input className="input-field" dir="ltr" placeholder="Al Rashid Restaurant" value={form.commercialNameEn} onChange={f("commercialNameEn")} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="form-label">رقم الترخيص *</label>
                  <input className="input-field" dir="ltr" placeholder="123456" value={form.licenseNumber} onChange={f("licenseNumber")} /></div>
                <div><label className="form-label">المسئول والمدير</label>
                  <select className="input-field" value={form.investorId} onChange={f("investorId")}>
                    <option value="">— بدون مسئول —</option>
                    {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="form-label">الحالة</label>
                  <select className="input-field" value={form.status} onChange={f("status")}>
                    <option value="ACTIVE">فعال</option>
                    <option value="EXPIRED">منتهي</option>
                    <option value="SUSPENDED">موقوف</option>
                    <option value="CANCELLED">ملغاة</option>
                  </select></div>
                <div><label className="form-label">تاريخ الإصدار</label>
                  <input type="date" className="input-field" value={form.issueDate} onChange={f("issueDate")} /></div>
                <div><label className="form-label">انتهاء الترخيص التجاري</label>
                  <input type="date" className="input-field" value={form.licenseExpiryDate} onChange={f("licenseExpiryDate")} /></div>
              </div>
            </div>

            {/* تواريخ انتهاء الرخص الأخرى */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">تواريخ انتهاء الرخص الأخرى</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="form-label">رخصة الإطفاء</label>
                  <input type="date" className="input-field" value={form.fireLicenseExpiryDate} onChange={f("fireLicenseExpiryDate")} /></div>
                <div><label className="form-label">الترخيص الصحي</label>
                  <input type="date" className="input-field" value={form.healthLicenseExpiryDate} onChange={f("healthLicenseExpiryDate")} /></div>
                <div><label className="form-label">رخصة الإعلانات</label>
                  <input type="date" className="input-field" value={form.advertisingLicenseExpiryDate} onChange={f("advertisingLicenseExpiryDate")} /></div>
              </div>
            </div>

            {/* المسؤول والأرقام الرسمية */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">المسؤول والأرقام الرسمية</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">اسم المدير</label>
                  <input className="input-field" placeholder="اسم المدير المسؤول" value={form.managerName} onChange={f("managerName")} /></div>
                <div><label className="form-label">هاتف المدير</label>
                  <input className="input-field" dir="ltr" placeholder="+965XXXXXXXX" value={form.managerPhone} onChange={f("managerPhone")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">رقم الكيان الموحد</label>
                  <input className="input-field" dir="ltr" value={form.unifiedEntityNumber} onChange={f("unifiedEntityNumber")} /></div>
                <div><label className="form-label">رقم الكيان المدني</label>
                  <input className="input-field" dir="ltr" value={form.civilEntityNumber} onChange={f("civilEntityNumber")} /></div>
              </div>
            </div>

            {/* الشكل القانوني */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">الشكل القانوني والمالي</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="form-label">الشكل القانوني</label>
                  <select className="input-field w-full" value={form.legalEntity} onChange={f("legalEntity")}>
                    <option value="">— اختر —</option>
                    <option value="LLC">ذات مسئولية محدودة</option>
                    <option value="PARTNERSHIP">تضامنية</option>
                    <option value="JOINT_STOCK">مساهمة</option>
                    <option value="SOLE">مؤسسة فردية</option>
                    <option value="OTHER">أخرى</option>
                  </select></div>
                <div><label className="form-label">رأس المال (د.ك)</label>
                  <input type="number" step="0.001" className="input-field" dir="ltr" placeholder="0.000" value={form.capital} onChange={f("capital")} /></div>
                <div><label className="form-label">رقم السجل التجاري</label>
                  <input className="input-field" dir="ltr" value={form.commercialRegNo} onChange={f("commercialRegNo")} /></div>
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field" rows={2} placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={f("notes")} />
            </div>

            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "إضافة"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {deleteId && (
        <Modal title="تأكيد الحذف" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الترخيص؟ لا يمكن التراجع.</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button onClick={confirmDelete} disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? "جاري الحذف..." : "حذف"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Status change modal ───────────────────────────────────────────── */}
      {statusModal && (
        <Modal title="تغيير حالة الترخيص" onClose={() => setStatusModal(null)}>
          <div className="space-y-4">

            {/* اسم الترخيص */}
            <div className="rounded-lg bg-muted/40 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">الترخيص</p>
              <p className="font-medium text-sm mt-0.5">{statusModal.name}</p>
            </div>

            {/* الحالة الحالية */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">الحالة الحالية:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusModal.current] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[statusModal.current] ?? statusModal.current}
              </span>
            </div>

            {/* خيارات الحالة */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">اختر الحالة الجديدة</p>
              {([
                { value: "ACTIVE",    label: "فعال",    desc: "الترخيص ساري ومعتمد",            warn: false },
                { value: "EXPIRED",   label: "منتهي",   desc: "انتهت مدة الترخيص",             warn: false },
                { value: "SUSPENDED", label: "موقوف",   desc: "الترخيص موقوف مؤقتاً",          warn: false },
                { value: "CANCELLED", label: "ملغاة",   desc: "الترخيص ملغى نهائياً ← تحقق من الموظفين أولاً", warn: true },
              ] as const).map((opt) => {
                const isCurrent  = opt.value === statusModal.current;
                const isSelected = opt.value === newStatus;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setNewStatus(opt.value)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition-all",
                      isCurrent  ? "opacity-35 cursor-not-allowed border-border bg-muted/30" :
                      isSelected ? "border-primary bg-primary/5 shadow-sm" :
                                   "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[opt.value] ?? "bg-gray-100 text-gray-600"}`}>
                      {opt.label}
                    </span>
                    <span className={`flex-1 text-xs ${opt.warn ? "text-orange-600" : "text-muted-foreground"}`}>
                      {opt.desc}
                    </span>
                    {isCurrent && <span className="text-[10px] text-muted-foreground">الحالية</span>}
                    {isSelected && !isCurrent && (
                      <span className="text-[10px] font-medium text-primary">✓ محدد</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* تحذير الإلغاء */}
            {newStatus === "CANCELLED" && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-700">
                ⚠️ تأكد من إنهاء أو نقل جميع الموظفين المرتبطين بهذا الترخيص قبل الإلغاء.
              </div>
            )}

            {statusError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{statusError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setStatusModal(null)}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                إلغاء
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={statusSaving || !newStatus || newStatus === statusModal.current}
                className="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
              >
                {statusSaving ? "جاري الحفظ..." : "تطبيق التغيير"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
