"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowRight, Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";

interface Category {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  code?: string | null;
  type: string;
  isActive: boolean;
}

const categoryTypes = [
  { value: "HR", label: "موارد بشرية" },
  { value: "VEHICLE", label: "مركبات" },
  { value: "LEGAL", label: "قانوني / إقامات" },
  { value: "UTILITIES", label: "مرافق واتصالات" },
  { value: "OPERATIONAL", label: "تشغيلي" },
  { value: "ADMINISTRATIVE", label: "إداري" },
  { value: "OTHER", label: "أخرى" },
];

const typeColors: Record<string, string> = {
  HR: "bg-blue-100 text-blue-700",
  VEHICLE: "bg-orange-100 text-orange-700",
  LEGAL: "bg-purple-100 text-purple-700",
  UTILITIES: "bg-cyan-100 text-cyan-700",
  OPERATIONAL: "bg-green-100 text-green-700",
  ADMINISTRATIVE: "bg-gray-100 text-gray-700",
  OTHER: "bg-yellow-100 text-yellow-700",
};

export default function ExpenseCategoriesPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ nameAr: "", nameEn: "", code: "", type: "OPERATIONAL" });
  const [addLoading, setAddLoading] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nameAr: "", nameEn: "", code: "", type: "" });
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/expenses/categories?companyId=${companyId}&all=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.data);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAddLoading(true);
    try {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...addForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في الإضافة");
      setAddForm({ nameAr: "", nameEn: "", code: "", type: "OPERATIONAL" });
      setShowAdd(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditForm({ nameAr: cat.nameAr, nameEn: cat.nameEn ?? "", code: cat.code ?? "", type: cat.type });
    setError("");
  }

  async function handleEdit(categoryId: string) {
    setError("");
    setEditLoading(true);
    try {
      const res = await fetch(`/api/expenses/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في التحديث");
      setEditId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function toggleActive(cat: Category) {
    try {
      const res = await fetch(`/api/expenses/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(categoryId: string) {
    if (!confirm("هل أنت متأكد من حذف هذه الفئة نهائياً؟")) return;
    setError("");
    try {
      const res = await fetch(`/api/expenses/categories/${categoryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل في الحذف");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  return (
    <div>
      <Header
        title="فئات المصروفات"
        subtitle="إدارة تصنيفات المصروفات"
        companyId={companyId}
        actions={
          <button
            onClick={() => { setShowAdd(true); setError(""); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus size={16} /> فئة جديدة
          </button>
        }
      />

      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/expenses`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowRight size={14} /> العودة للمصروفات
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="section-card space-y-3 mb-4">
            <h3 className="font-bold text-sm">إضافة فئة جديدة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">الاسم بالعربي <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={addForm.nameAr}
                  onChange={(e) => setAddForm((p) => ({ ...p, nameAr: e.target.value }))}
                  className="input-field w-full"
                  placeholder="مثال: إيجار مكتب"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">الاسم بالإنجليزي</label>
                <input
                  type="text"
                  value={addForm.nameEn}
                  onChange={(e) => setAddForm((p) => ({ ...p, nameEn: e.target.value }))}
                  className="input-field w-full"
                  dir="ltr"
                  placeholder="Office Rent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">النوع <span className="text-red-500">*</span></label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value }))}
                  className="input-field w-full"
                >
                  {categoryTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">الكود (اختياري)</label>
                <input
                  type="text"
                  value={addForm.code}
                  onChange={(e) => setAddForm((p) => ({ ...p, code: e.target.value }))}
                  className="input-field w-full"
                  dir="ltr"
                  placeholder="RENT_OFFICE"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={addLoading}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Check size={14} /> {addLoading ? "جاري الحفظ..." : "إضافة"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted"
              >
                <X size={14} /> إلغاء
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="section-card text-center py-10 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="space-y-4">
            {/* Active categories */}
            <div className="section-card">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                الفئات النشطة ({active.length})
              </h3>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد فئات نشطة</p>
              ) : (
                <div className="space-y-2">
                  {active.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                      {editId === cat.id ? (
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            value={editForm.nameAr}
                            onChange={(e) => setEditForm((p) => ({ ...p, nameAr: e.target.value }))}
                            className="input-field col-span-2"
                            placeholder="الاسم بالعربي"
                            autoFocus
                          />
                          <select
                            value={editForm.type}
                            onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                            className="input-field"
                          >
                            {categoryTypes.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            value={editForm.code}
                            onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))}
                            className="input-field"
                            placeholder="الكود"
                            dir="ltr"
                          />
                          <div className="col-span-2 flex gap-2">
                            <button
                              onClick={() => handleEdit(cat.id)}
                              disabled={editLoading}
                              className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                            >
                              <Check size={12} /> حفظ
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-border hover:bg-muted"
                            >
                              <X size={12} /> إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{cat.nameAr}</p>
                            {cat.code && <p className="text-xs text-muted-foreground" dir="ltr">{cat.code}</p>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[cat.type] ?? "bg-gray-100 text-gray-700"}`}>
                            {categoryTypes.find((t) => t.value === cat.type)?.label ?? cat.type}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(cat)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="تعديل"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => toggleActive(cat)}
                              className="p-1.5 hover:bg-muted rounded text-green-600 hover:text-orange-500"
                              title="إلغاء التفعيل"
                            >
                              <ToggleRight size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inactive categories */}
            {inactive.length > 0 && (
              <div className="section-card opacity-70">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  الفئات المعطلة ({inactive.length})
                </h3>
                <div className="space-y-2">
                  {inactive.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 p-2.5 bg-muted/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-through text-muted-foreground">{cat.nameAr}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full opacity-50 ${typeColors[cat.type] ?? "bg-gray-100 text-gray-700"}`}>
                        {categoryTypes.find((t) => t.value === cat.type)?.label ?? cat.type}
                      </span>
                      <button
                        onClick={() => toggleActive(cat)}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-green-600"
                        title="إعادة تفعيل"
                      >
                        <ToggleLeft size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                        title="حذف نهائي"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
