"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowRight, Save, Link2, Link2Off, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Group { id: string; nameAr: string; }
interface Company {
  id: string; nameAr: string; nameEn?: string; type: string;
  commercialReg?: string; address?: string; phone?: string; email?: string;
  isActive: boolean; groupId: string;
  group: { id: string; nameAr: string; };
}

const companyTypes = [
  { value: "DELIVERY",  label: "توصيل طلبات" },
  { value: "CAR_WASH",  label: "غسيل سيارات" },
  { value: "TRADING",   label: "تجارة عامة" },
  { value: "HOLDING",   label: "شركة قابضة" },
  { value: "OTHER",     label: "أخرى" },
];

export default function EditCompanyPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  // Group action: "keep" | "move" | "separate"
  const [groupAction, setGroupAction] = useState<"keep" | "move" | "separate">("keep");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [newGroupNameAr, setNewGroupNameAr] = useState("");

  const [form, setForm] = useState({
    nameAr: "", nameEn: "", type: "TRADING",
    commercialReg: "", address: "", phone: "", email: "", isActive: true,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/companies/${companyId}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
    ]).then(([comp, grps]) => {
      if (comp.success) {
        const c: Company = comp.data;
        setCompany(c);
        setForm({
          nameAr: c.nameAr,
          nameEn: c.nameEn ?? "",
          type: c.type,
          commercialReg: c.commercialReg ?? "",
          address: c.address ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          isActive: c.isActive,
        });
      }
      if (grps.success) setGroups(grps.data);
    });
  }, [companyId]);

  function set(field: string, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (groupAction === "separate" && !newGroupNameAr.trim()) {
      setError("يرجى إدخال اسم المجموعة الجديدة");
      return;
    }
    if (groupAction === "move" && !targetGroupId) {
      setError("يرجى اختيار المجموعة");
      return;
    }

    setLoading(true);
    try {
      const body: any = { ...form };

      if (groupAction === "separate") {
        body.newGroupNameAr = newGroupNameAr.trim();
      } else if (groupAction === "move") {
        body.groupId = targetGroupId;
      }

      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في الحفظ");
      router.push("/dashboard/settings");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!company) {
    return (
      <div>
        <Header title="تعديل الشركة" />
        <div className="page-container">
          <div className="section-card text-center py-12 text-muted-foreground">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  const otherGroups = groups.filter((g) => g.id !== company.groupId);

  return (
    <div>
      <Header title={`تعديل — ${company.nameAr}`} subtitle="إعدادات الشركة والمجموعة" />
      <div className="page-container max-w-2xl">
        <Link href="/dashboard/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowRight size={14} /> العودة للإعدادات
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Group Management */}
          <div className="section-card space-y-4">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">إعدادات المجموعة</h3>

            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
              <Link2 size={16} className="text-primary flex-shrink-0" />
              <span>المجموعة الحالية: <strong>{company.group.nameAr}</strong></span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Keep */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${groupAction === "keep" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                <input
                  type="radio"
                  name="groupAction"
                  checked={groupAction === "keep"}
                  onChange={() => setGroupAction("keep")}
                  className="accent-primary"
                />
                <div>
                  <p className="font-medium text-sm">الإبقاء في نفس المجموعة</p>
                  <p className="text-xs text-muted-foreground">لا يوجد تغيير في ارتباط الشركة</p>
                </div>
              </label>

              {/* Move to other group */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${groupAction === "move" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                <input
                  type="radio"
                  name="groupAction"
                  checked={groupAction === "move"}
                  onChange={() => setGroupAction("move")}
                  className="accent-primary mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">نقل إلى مجموعة أخرى</p>
                  <p className="text-xs text-muted-foreground mb-2">الشركة ستنضم لمجموعة موجودة</p>
                  {groupAction === "move" && (
                    <select
                      value={targetGroupId}
                      onChange={(e) => setTargetGroupId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">اختر المجموعة...</option>
                      {otherGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.nameAr}</option>
                      ))}
                    </select>
                  )}
                  {groupAction === "move" && otherGroups.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">لا توجد مجموعات أخرى — أنشئ مجموعة جديدة أولاً</p>
                  )}
                </div>
              </label>

              {/* Separate into new group */}
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${groupAction === "separate" ? "border-orange-400 bg-orange-50" : "border-border hover:bg-muted/30"}`}>
                <input
                  type="radio"
                  name="groupAction"
                  checked={groupAction === "separate"}
                  onChange={() => setGroupAction("separate")}
                  className="accent-orange-500 mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link2Off size={14} className="text-orange-600" />
                    <p className="font-medium text-sm text-orange-700">فصل الشركة في مجموعة منفصلة</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">ستصبح الشركة مستقلة تماماً في مجموعة جديدة</p>
                  {groupAction === "separate" && (
                    <>
                      <div className="flex items-start gap-2 bg-orange-100 rounded-lg px-3 py-2 mb-2">
                        <AlertTriangle size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-700">
                          بعد الفصل، لن تظهر هذه الشركة مع باقي شركات المجموعة في التقارير الموحدة
                        </p>
                      </div>
                      <input
                        type="text"
                        value={newGroupNameAr}
                        onChange={(e) => setNewGroupNameAr(e.target.value)}
                        className="input-field w-full"
                        placeholder="اسم المجموعة الجديدة..."
                        autoFocus
                      />
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Company Info */}
          <div className="section-card space-y-4">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">بيانات الشركة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">الاسم بالعربي <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} className="input-field w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">الاسم بالإنجليزي</label>
                <input type="text" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">نوع النشاط</label>
                <select value={form.type} onChange={(e) => set("type", e.target.value)} className="input-field w-full">
                  {companyTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">السجل التجاري</label>
                <input type="text" value={form.commercialReg} onChange={(e) => set("commercialReg", e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الهاتف</label>
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">العنوان</label>
                <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} className="input-field w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium">الشركة نشطة</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
            <Link href="/dashboard/settings" className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted">
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
