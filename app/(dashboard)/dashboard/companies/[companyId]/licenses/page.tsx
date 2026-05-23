"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Branch { id: string; nameAr: string }
interface Investor { id: string; nameAr: string }
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
  branchId?: string | null;
  investorId?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  unifiedEntityNumber?: string | null;
  civilEntityNumber?: string | null;
  notes?: string | null;
  branch?: { nameAr: string } | null;
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
  branchId: "", investorId: "",
  managerName: "", managerPhone: "",
  unifiedEntityNumber: "", civilEntityNumber: "", notes: "",
};

type Form = typeof EMPTY;

function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryCell({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const days = daysLeft(date);
  const label = new Date(date).toLocaleDateString("ar-KW");
  if (days === null) return <span>{label}</span>;
  if (days < 0) return <span className="text-red-700 font-medium">{label}</span>;
  if (days <= 30) return <span className="text-red-600 font-medium">{label} <span className="text-xs">({days})</span></span>;
  if (days <= 90) return <span className="text-orange-500 font-medium">{label}</span>;
  return <span>{label}</span>;
}

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

export default function LicensesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [licenses, setLicenses] = useState<License[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      fetch(`/api/licenses?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()),
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()),
    ]);
    if (a.success) setLicenses(a.data);
    if (b.success) setBranches(b.data);
    if (c.success) setInvestors(c.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function f<K extends keyof Form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  function openAdd() {
    setForm(EMPTY);
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.commercialNameAr.trim()) { setFormError("الاسم التجاري مطلوب"); return; }
    if (!form.licenseNumber.trim()) { setFormError("رقم الترخيص مطلوب"); return; }
    if (!form.isMainLicense && !form.mainLicenseId) { setFormError("يجب اختيار الترخيص الرئيسي للترخيص الفرعي"); return; }
    setSaving(true);
    setFormError("");
    const body = {
      companyId,
      ...form,
      branchId: form.branchId || null,
      investorId: form.investorId || null,
      mainLicenseId: form.isMainLicense ? null : (form.mainLicenseId || null),
      issueDate: form.issueDate || null,
      licenseExpiryDate: form.licenseExpiryDate || null,
      fireLicenseExpiryDate: form.fireLicenseExpiryDate || null,
      healthLicenseExpiryDate: form.healthLicenseExpiryDate || null,
      advertisingLicenseExpiryDate: form.advertisingLicenseExpiryDate || null,
      managerName: form.managerName || null,
      managerPhone: form.managerPhone || null,
      unifiedEntityNumber: form.unifiedEntityNumber || null,
      civilEntityNumber: form.civilEntityNumber || null,
      notes: form.notes || null,
    };
    const res = await fetch("/api/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/licenses/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    setDeleteId(null);
    load();
  }

  const mainLicenses = licenses.filter((l) => l.isMainLicense);

  const expiringSoon = licenses.filter((l) => {
    const dates = [l.licenseExpiryDate, l.fireLicenseExpiryDate, l.healthLicenseExpiryDate, l.advertisingLicenseExpiryDate];
    return dates.some((d) => { const days = daysLeft(d); return days !== null && days >= 0 && days <= 90; });
  }).length;

  return (
    <div>
      <Header
        title="التراخيص"
        subtitle="إدارة التراخيص الرئيسية والفرعية"
        companyId={companyId}
        actions={
          <button onClick={openAdd} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            + إضافة ترخيص
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي التراخيص</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{licenses.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">تراخيص رئيسية</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{mainLicenses.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">تنتهي خلال 90 يوم</p>
            <p className={`mt-1 text-2xl font-bold ${expiringSoon > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{expiringSoon}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>الاسم التجاري</th>
                    <th>رقم الترخيص</th>
                    <th>الترخيص الرئيسي</th>
                    <th>الفرع</th>
                    <th>المستثمر</th>
                    <th>انتهاء الترخيص</th>
                    <th>انتهاء الإطفاء</th>
                    <th>انتهاء الصحة</th>
                    <th className="text-center">موظفون</th>
                    <th className="text-center">تراخيص فرعية</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-muted-foreground">
                        لا توجد تراخيص — اضغط "إضافة ترخيص" للبدء
                      </td>
                    </tr>
                  ) : licenses.map((lic) => (
                    <tr
                      key={lic.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${lic.id}`)}
                    >
                      <td className="font-medium">
                        {!lic.isMainLicense && (
                          <span className="mr-1 inline-block h-3 w-0.5 rounded bg-blue-400"></span>
                        )}
                        {lic.commercialNameAr}
                        {!lic.isMainLicense && (
                          <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">فرعي</span>
                        )}
                      </td>
                      <td className="font-mono text-sm">{lic.licenseNumber}</td>
                      <td className="text-sm">
                        {lic.mainLicense
                          ? <span className="text-blue-600">{lic.mainLicense.commercialNameAr}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td>{lic.branch?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                      <td>{lic.investor?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                      <td><ExpiryCell date={lic.licenseExpiryDate} /></td>
                      <td><ExpiryCell date={lic.fireLicenseExpiryDate} /></td>
                      <td><ExpiryCell date={lic.healthLicenseExpiryDate} /></td>
                      <td className="text-center">{lic._count.employees}</td>
                      <td className="text-center">
                        {lic.isMainLicense
                          ? <span className={lic._count.branchLicenses > 0 ? "font-bold text-blue-600" : "text-muted-foreground"}>
                              {lic._count.branchLicenses}
                            </span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          lic.status === "ACTIVE"    ? "bg-emerald-100 text-emerald-700" :
                          lic.status === "EXPIRED"   ? "bg-red-100 text-red-700" :
                          lic.status === "SUSPENDED" ? "bg-orange-100 text-orange-700" :
                          lic.status === "CANCELLED" ? "bg-rose-100 text-rose-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {lic.status === "ACTIVE" ? "نشط" : lic.status === "EXPIRED" ? "منتهي" : lic.status === "SUSPENDED" ? "موقوف" : lic.status === "CANCELLED" ? "ملغاة" : "غير نشط"}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setDeleteId(lic.id); setDeleteError(""); }}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showForm && (
        <Modal title="إضافة ترخيص جديد" wide onClose={() => setShowForm(false)}>
          <div className="space-y-5">

            {/* ── النوع ── */}
            <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isMainLicense: true, mainLicenseId: "" }))}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  form.isMainLicense ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ترخيص رئيسي
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isMainLicense: false }))}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  !form.isMainLicense ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ترخيص فرعي
              </button>
            </div>

            {/* ── الترخيص الرئيسي (للفرعي فقط) ── */}
            {!form.isMainLicense && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <label className="form-label text-blue-700">الترخيص الرئيسي *</label>
                <select className="input-field" value={form.mainLicenseId} onChange={f("mainLicenseId")}>
                  <option value="">— اختر الترخيص الرئيسي —</option>
                  {mainLicenses.map((l) => (
                    <option key={l.id} value={l.id}>{l.commercialNameAr} ({l.licenseNumber})</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── البيانات الأساسية ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">البيانات الأساسية</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الاسم التجاري (عربي) *</label>
                  <input className="input-field" placeholder="مثال: مطعم الراشد" value={form.commercialNameAr} onChange={f("commercialNameAr")} />
                </div>
                <div>
                  <label className="form-label">الاسم التجاري (إنجليزي)</label>
                  <input className="input-field" dir="ltr" placeholder="Al Rashid Restaurant" value={form.commercialNameEn} onChange={f("commercialNameEn")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">رقم الترخيص *</label>
                  <input className="input-field" dir="ltr" placeholder="123456" value={form.licenseNumber} onChange={f("licenseNumber")} />
                </div>
                <div>
                  <label className="form-label">الفرع</label>
                  <select className="input-field" value={form.branchId} onChange={f("branchId")}>
                    <option value="">— بدون فرع —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">المستثمر</label>
                  <select className="input-field" value={form.investorId} onChange={f("investorId")}>
                    <option value="">— بدون مستثمر —</option>
                    {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">الحالة</label>
                  <select className="input-field" value={form.status} onChange={f("status")}>
                    <option value="ACTIVE">نشط</option>
                    <option value="INACTIVE">غير نشط</option>
                    <option value="EXPIRED">منتهي</option>
                    <option value="SUSPENDED">موقوف</option>
                    <option value="CANCELLED">ملغاة</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">تاريخ الإصدار</label>
                  <input type="date" className="input-field" value={form.issueDate} onChange={f("issueDate")} />
                </div>
                <div>
                  <label className="form-label">انتهاء الترخيص التجاري</label>
                  <input type="date" className="input-field" value={form.licenseExpiryDate} onChange={f("licenseExpiryDate")} />
                </div>
              </div>
            </div>

            {/* ── تواريخ الانتهاء ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">تواريخ انتهاء الرخص الأخرى</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">رخصة الإطفاء</label>
                  <input type="date" className="input-field" value={form.fireLicenseExpiryDate} onChange={f("fireLicenseExpiryDate")} />
                </div>
                <div>
                  <label className="form-label">الترخيص الصحي</label>
                  <input type="date" className="input-field" value={form.healthLicenseExpiryDate} onChange={f("healthLicenseExpiryDate")} />
                </div>
                <div>
                  <label className="form-label">رخصة الإعلانات</label>
                  <input type="date" className="input-field" value={form.advertisingLicenseExpiryDate} onChange={f("advertisingLicenseExpiryDate")} />
                </div>
              </div>
            </div>

            {/* ── المسؤول والكيانات ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">المسؤول والأرقام الرسمية</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">اسم المدير</label>
                  <input className="input-field" placeholder="اسم المدير المسؤول" value={form.managerName} onChange={f("managerName")} />
                </div>
                <div>
                  <label className="form-label">هاتف المدير</label>
                  <input className="input-field" dir="ltr" placeholder="965XXXXXXXX+" value={form.managerPhone} onChange={f("managerPhone")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">رقم الكيان الموحد</label>
                  <input className="input-field" dir="ltr" placeholder="رقم الكيان الموحد" value={form.unifiedEntityNumber} onChange={f("unifiedEntityNumber")} />
                </div>
                <div>
                  <label className="form-label">رقم الكيان المدني</label>
                  <input className="input-field" dir="ltr" placeholder="رقم الكيان المدني" value={form.civilEntityNumber} onChange={f("civilEntityNumber")} />
                </div>
              </div>
            </div>

            {/* ── ملاحظات ── */}
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field" rows={2} placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={f("notes")} />
            </div>

            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                إلغاء
              </button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "إضافة"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="تأكيد الحذف" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الترخيص؟ لا يمكن التراجع.</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "جاري الحذف..." : "حذف"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
