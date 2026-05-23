"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { formatKWD } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface AssetType {
  id: string;
  nameAr: string;
  nameEn: string | null;
  requiresSerialNumber: boolean;
  _count: { assetItems: number };
}

interface ActiveCustody {
  id: string;
  assignmentTargetType: string;
  assignedDate: string;
  conditionOnAssign: string | null;
  employee: { nameAr: string; nameEn: string | null } | null;
  driver: { employee: { nameAr: string; nameEn: string | null } } | null;
}

interface AssetItem {
  id: string;
  nameAr: string;
  nameEn: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  currentCondition: string;
  status: string;
  notes: string | null;
  assetItemType: { nameAr: string; nameEn: string | null };
  custodies: ActiveCustody[];
}

interface Custody {
  id: string;
  assignedDate: string;
  returnedDate: string | null;
  conditionOnAssign: string | null;
  conditionOnReturn: string | null;
  status: string;
  notes: string | null;
  assignmentTargetType: string;
  assetItem: { nameAr: string; nameEn: string | null; assetItemType: { nameAr: string; nameEn: string | null } };
  employee: { nameAr: string; nameEn: string | null } | null;
  driver: { employee: { nameAr: string; nameEn: string | null } } | null;
  assignedBy: { nameAr: string; nameEn: string | null };
}

interface Employee {
  id: string;
  nameAr: string;
  nameEn: string | null;
  type: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  NEW: { ar: "جديد", en: "New", color: "bg-emerald-100 text-emerald-700" },
  GOOD: { ar: "جيد", en: "Good", color: "bg-blue-100 text-blue-700" },
  USED: { ar: "مستعمل", en: "Used", color: "bg-yellow-100 text-yellow-700" },
  DAMAGED: { ar: "تالف", en: "Damaged", color: "bg-red-100 text-red-700" },
  LOST: { ar: "مفقود", en: "Lost", color: "bg-gray-100 text-gray-700" },
  UNDER_MAINTENANCE: { ar: "صيانة", en: "Maintenance", color: "bg-purple-100 text-purple-700" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  AVAILABLE: { ar: "متاح", en: "Available", color: "bg-emerald-100 text-emerald-700" },
  ASSIGNED: { ar: "مُسلَّم", en: "Assigned", color: "bg-blue-100 text-blue-700" },
  RETURNED: { ar: "مُسترجع", en: "Returned", color: "bg-gray-100 text-gray-700" },
  LOST: { ar: "مفقود", en: "Lost", color: "bg-red-100 text-red-700" },
  DAMAGED: { ar: "تالف", en: "Damaged", color: "bg-orange-100 text-orange-700" },
  DISPOSED: { ar: "مُتخلَّص منه", en: "Disposed", color: "bg-gray-100 text-gray-500" },
};

function Badge({ value, map }: { value: string; map: Record<string, { ar: string; en: string; color: string }> }) {
  const { locale } = useLocale();
  const entry = map[value];
  if (!entry) return <span>{value}</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.color}`}>
      {locale === "en" ? entry.en : entry.ar}
    </span>
  );
}

function holderName(custody: ActiveCustody | Custody, locale: string) {
  if (custody.employee)
    return locale === "en" ? custody.employee.nameEn ?? custody.employee.nameAr : custody.employee.nameAr;
  if (custody.driver?.employee)
    return locale === "en"
      ? custody.driver.employee.nameEn ?? custody.driver.employee.nameAr
      : custody.driver.employee.nameAr;
  return "—";
}

function fmt(dateStr: string | null | undefined, locale: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-GB" : "ar-KW");
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = "items" | "custodies" | "types";

export default function AssetsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();

  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [custodies, setCustodies] = useState<Custody[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewItem, setShowNewItem] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [showAssign, setShowAssign] = useState<AssetItem | null>(null);
  const [showReturn, setShowReturn] = useState<Custody | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [itemsRes, custodiesRes, typesRes, empRes] = await Promise.all([
      fetch(`/api/assets/items?companyId=${companyId}`),
      fetch(`/api/assets/custodies?companyId=${companyId}`),
      fetch(`/api/assets/types?companyId=${companyId}`),
      fetch(`/api/hr/employees?companyId=${companyId}`),
    ]);
    const [ip, cp, tp, ep] = await Promise.all([
      itemsRes.json(), custodiesRes.json(), typesRes.json(), empRes.json(),
    ]);
    if (ip.success) setItems(ip.data);
    if (cp.success) setCustodies(cp.data);
    if (tp.success) setTypes(tp.data);
    if (ep.success) setEmployees(Array.isArray(ep.data) ? ep.data : []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const activeCustodies = custodies.filter((c) => c.status === "ACTIVE");
  const availableItems = items.filter((i) => i.status === "AVAILABLE");

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; ar: string; en: string; count: number }[] = [
    { id: "items", ar: "الأصناف", en: "Items", count: items.length },
    { id: "custodies", ar: "العهد النشطة", en: "Active Custodies", count: activeCustodies.length },
    { id: "types", ar: "الأنواع", en: "Types", count: types.length },
  ];

  return (
    <div>
      <Header
        title={locale === "en" ? "Assets & Custodies" : "الأصول والعهد"}
        subtitle={locale === "en" ? "Manage company assets and their assignments" : "إدارة أصول الشركة وعهدها"}
        companyId={companyId}
        actions={
          tab === "items" ? (
            <button onClick={() => setShowNewItem(true)} className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
              <Plus size={15} />
              {locale === "en" ? "New asset" : "صنف جديد"}
            </button>
          ) : tab === "types" ? (
            <button onClick={() => setShowNewType(true)} className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium">
              <Plus size={15} />
              {locale === "en" ? "New type" : "نوع جديد"}
            </button>
          ) : null
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Total assets" : "إجمالي الأصناف"}</p>
            <p className="text-2xl font-bold">{items.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Assigned" : "مُسلَّمة"}</p>
            <p className="text-2xl font-bold text-blue-600">{items.filter((i) => i.status === "ASSIGNED").length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Available" : "متاحة"}</p>
            <p className="text-2xl font-bold text-emerald-600">{availableItems.length}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {locale === "en" ? t.en : t.ar}
              <span className="ms-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {locale === "en" ? "Loading..." : "جاري التحميل..."}
          </p>
        ) : (
          <div className="section-card overflow-hidden">
            <div className="overflow-x-auto">

              {/* ── Items tab ── */}
              {tab === "items" && (
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{locale === "en" ? "Name" : "الاسم"}</th>
                      <th>{locale === "en" ? "Type" : "النوع"}</th>
                      <th>{locale === "en" ? "Serial" : "السريال"}</th>
                      <th>{locale === "en" ? "Condition" : "الحالة"}</th>
                      <th>{locale === "en" ? "Status" : "الوضع"}</th>
                      <th>{locale === "en" ? "Current holder" : "بحوزة"}</th>
                      <th>{locale === "en" ? "Purchase cost" : "تكلفة الشراء"}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-muted-foreground">
                          {locale === "en" ? "No assets registered" : "لا توجد أصناف مسجلة"}
                        </td>
                      </tr>
                    ) : items.map((item) => {
                      const activeCustody = item.custodies[0] ?? null;
                      return (
                        <tr key={item.id}>
                          <td className="font-medium">{locale === "en" ? item.nameEn ?? item.nameAr : item.nameAr}</td>
                          <td className="text-sm text-muted-foreground">
                            {locale === "en" ? item.assetItemType.nameEn ?? item.assetItemType.nameAr : item.assetItemType.nameAr}
                          </td>
                          <td className="number text-sm">{item.serialNumber ?? "—"}</td>
                          <td><Badge value={item.currentCondition} map={CONDITION_LABELS} /></td>
                          <td><Badge value={item.status} map={STATUS_LABELS} /></td>
                          <td className="text-sm">
                            {activeCustody ? holderName(activeCustody, locale) : "—"}
                          </td>
                          <td className="number text-sm">
                            {item.purchaseCost ? formatKWD(Number(item.purchaseCost), locale === "en" ? "en-US" : "ar-KW") : "—"}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {item.status === "AVAILABLE" && (
                                <button
                                  onClick={() => setShowAssign(item)}
                                  className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                >
                                  {locale === "en" ? "Assign" : "تسليم"}
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (!window.confirm(locale === "en" ? "Delete this asset?" : "حذف هذا الصنف؟")) return;
                                  await fetch(`/api/assets/items?id=${item.id}`, { method: "DELETE" });
                                  await loadAll();
                                }}
                                className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                                title={locale === "en" ? "Delete" : "حذف"}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* ── Custodies tab ── */}
              {tab === "custodies" && (
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{locale === "en" ? "Asset" : "الصنف"}</th>
                      <th>{locale === "en" ? "Type" : "النوع"}</th>
                      <th>{locale === "en" ? "Holder" : "بحوزة"}</th>
                      <th>{locale === "en" ? "Assigned date" : "تاريخ التسليم"}</th>
                      <th>{locale === "en" ? "Condition" : "الحالة عند التسليم"}</th>
                      <th>{locale === "en" ? "Status" : "الوضع"}</th>
                      <th>{locale === "en" ? "Assigned by" : "سلّمه"}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustodies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-muted-foreground">
                          {locale === "en" ? "No active custodies" : "لا توجد عهد نشطة"}
                        </td>
                      </tr>
                    ) : activeCustodies.map((custody) => (
                      <tr key={custody.id}>
                        <td className="font-medium">
                          {locale === "en" ? custody.assetItem.nameEn ?? custody.assetItem.nameAr : custody.assetItem.nameAr}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {locale === "en"
                            ? custody.assetItem.assetItemType.nameEn ?? custody.assetItem.assetItemType.nameAr
                            : custody.assetItem.assetItemType.nameAr}
                        </td>
                        <td className="text-sm">{holderName(custody, locale)}</td>
                        <td className="text-sm">{fmt(custody.assignedDate, locale)}</td>
                        <td>
                          {custody.conditionOnAssign
                            ? <Badge value={custody.conditionOnAssign} map={CONDITION_LABELS} />
                            : "—"}
                        </td>
                        <td><Badge value={custody.status} map={STATUS_LABELS} /></td>
                        <td className="text-sm">
                          {locale === "en"
                            ? custody.assignedBy.nameEn ?? custody.assignedBy.nameAr
                            : custody.assignedBy.nameAr}
                        </td>
                        <td>
                          <button
                            onClick={() => setShowReturn(custody)}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          >
                            <RotateCcw size={12} />
                            {locale === "en" ? "Return" : "استرجاع"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ── Types tab ── */}
              {tab === "types" && (
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{locale === "en" ? "Name (Arabic)" : "الاسم (عربي)"}</th>
                      <th>{locale === "en" ? "Name (English)" : "الاسم (إنجليزي)"}</th>
                      <th>{locale === "en" ? "Requires serial" : "يحتاج سريال"}</th>
                      <th>{locale === "en" ? "Items count" : "عدد الأصناف"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-muted-foreground">
                          {locale === "en" ? "No types defined" : "لا توجد أنواع مضافة"}
                        </td>
                      </tr>
                    ) : types.map((type) => (
                      <tr key={type.id}>
                        <td className="font-medium">{type.nameAr}</td>
                        <td className="text-sm text-muted-foreground">{type.nameEn ?? "—"}</td>
                        <td>{type.requiresSerialNumber ? (locale === "en" ? "Yes" : "نعم") : (locale === "en" ? "No" : "لا")}</td>
                        <td>{type._count.assetItems}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── New Asset Item Modal ── */}
      {showNewItem && (
        <NewItemModal
          companyId={companyId}
          types={types}
          locale={locale}
          onClose={() => setShowNewItem(false)}
          onSaved={loadAll}
        />
      )}

      {/* ── New Type Modal ── */}
      {showNewType && (
        <NewTypeModal
          companyId={companyId}
          locale={locale}
          onClose={() => setShowNewType(false)}
          onSaved={loadAll}
        />
      )}

      {/* ── Assign Modal ── */}
      {showAssign && (
        <AssignModal
          companyId={companyId}
          item={showAssign}
          employees={employees}
          locale={locale}
          onClose={() => setShowAssign(null)}
          onSaved={loadAll}
        />
      )}

      {/* ── Return Modal ── */}
      {showReturn && (
        <ReturnModal
          custody={showReturn}
          locale={locale}
          onClose={() => setShowReturn(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}

// ── Modal: New Asset Item ─────────────────────────────────────────────────────

function NewItemModal({
  companyId, types, locale, onClose, onSaved,
}: {
  companyId: string;
  types: AssetType[];
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assetItemTypeId: types[0]?.id ?? "",
    nameAr: "",
    nameEn: "",
    serialNumber: "",
    purchaseDate: "",
    purchaseCost: "",
    currentCondition: "NEW",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/assets/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        assetItemTypeId: form.assetItemTypeId,
        nameAr: form.nameAr,
        nameEn: form.nameEn || undefined,
        serialNumber: form.serialNumber || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        currentCondition: form.currentCondition,
        notes: form.notes || undefined,
      }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { window.alert(payload.error); return; }
    onSaved();
    onClose();
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal title={locale === "en" ? "New asset item" : "صنف جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">{locale === "en" ? "Type" : "النوع"} *</label>
            <select value={form.assetItemTypeId} onChange={f("assetItemTypeId")} className="input-field" required>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {locale === "en" ? t.nameEn ?? t.nameAr : t.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Name (Arabic)" : "الاسم (عربي)"} *</label>
            <input value={form.nameAr} onChange={f("nameAr")} className="input-field" required />
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Name (English)" : "الاسم (إنجليزي)"}</label>
            <input value={form.nameEn} onChange={f("nameEn")} className="input-field" />
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Serial number" : "الرقم التسلسلي"}</label>
            <input value={form.serialNumber} onChange={f("serialNumber")} className="input-field" />
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Condition" : "الحالة"}</label>
            <select value={form.currentCondition} onChange={f("currentCondition")} className="input-field">
              {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{locale === "en" ? v.en : v.ar}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Purchase date" : "تاريخ الشراء"}</label>
            <input type="date" value={form.purchaseDate} onChange={f("purchaseDate")} className="input-field" />
          </div>
          <div>
            <label className="form-label">{locale === "en" ? "Purchase cost (KWD)" : "تكلفة الشراء (د.ك)"}</label>
            <input type="number" step="0.001" min="0" value={form.purchaseCost} onChange={f("purchaseCost")} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="form-label">{locale === "en" ? "Notes" : "ملاحظات"}</label>
            <textarea value={form.notes} onChange={f("notes")} className="input-field" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
          <button type="submit" disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save" : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: New Type ───────────────────────────────────────────────────────────

function NewTypeModal({
  companyId, locale, onClose, onSaved,
}: {
  companyId: string;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", requiresSerialNumber: false });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/assets/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...form, nameEn: form.nameEn || undefined }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { window.alert(payload.error); return; }
    onSaved();
    onClose();
  }

  return (
    <Modal title={locale === "en" ? "New asset type" : "نوع أصل جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="form-label">{locale === "en" ? "Name (Arabic)" : "الاسم (عربي)"} *</label>
          <input value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} className="input-field" required />
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Name (English)" : "الاسم (إنجليزي)"}</label>
          <input value={form.nameEn} onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))} className="input-field" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requiresSerialNumber}
            onChange={(e) => setForm((p) => ({ ...p, requiresSerialNumber: e.target.checked }))}
          />
          {locale === "en" ? "Requires serial number" : "يحتاج رقم تسلسلي"}
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
          <button type="submit" disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save" : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: Assign Asset ───────────────────────────────────────────────────────

function AssignModal({
  companyId, item, employees, locale, onClose, onSaved,
}: {
  companyId: string;
  item: AssetItem;
  employees: Employee[];
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    assignedDate: new Date().toISOString().slice(0, 10),
    conditionOnAssign: item.currentCondition,
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId) { window.alert(locale === "en" ? "Select an employee" : "اختر موظفاً"); return; }
    setSaving(true);
    const res = await fetch("/api/assets/custodies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        assetItemId: item.id,
        assignmentTargetType: "EMPLOYEE",
        assignmentTargetId: form.employeeId,
        employeeId: form.employeeId,
        assignedDate: form.assignedDate,
        conditionOnAssign: form.conditionOnAssign || undefined,
        notes: form.notes || undefined,
      }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { window.alert(payload.error); return; }
    onSaved();
    onClose();
  }

  const itemName = locale === "en" ? item.nameEn ?? item.nameAr : item.nameAr;

  return (
    <Modal title={`${locale === "en" ? "Assign" : "تسليم"}: ${itemName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="form-label">{locale === "en" ? "Employee" : "الموظف"} *</label>
          <select value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} className="input-field" required>
            <option value="">{locale === "en" ? "Select employee..." : "اختر موظفاً..."}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {locale === "en" ? emp.nameEn ?? emp.nameAr : emp.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Assign date" : "تاريخ التسليم"} *</label>
          <input type="date" value={form.assignedDate} onChange={(e) => setForm((p) => ({ ...p, assignedDate: e.target.value }))} className="input-field" required />
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Condition on assign" : "الحالة عند التسليم"}</label>
          <select value={form.conditionOnAssign} onChange={(e) => setForm((p) => ({ ...p, conditionOnAssign: e.target.value }))} className="input-field">
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{locale === "en" ? v.en : v.ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Notes" : "ملاحظات"}</label>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="input-field" rows={2} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
          <button type="submit" disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Assign" : "تسليم"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal: Return Asset ───────────────────────────────────────────────────────

function ReturnModal({
  custody, locale, onClose, onSaved,
}: {
  custody: Custody;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    returnedDate: new Date().toISOString().slice(0, 10),
    conditionOnReturn: custody.conditionOnAssign ?? "GOOD",
    custodyStatus: "RETURNED",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/assets/custodies/${custody.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, conditionOnReturn: form.conditionOnReturn || undefined }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { window.alert(payload.error); return; }
    onSaved();
    onClose();
  }

  const assetName = locale === "en"
    ? custody.assetItem.nameEn ?? custody.assetItem.nameAr
    : custody.assetItem.nameAr;

  return (
    <Modal title={`${locale === "en" ? "Return" : "استرجاع"}: ${assetName}`} onClose={onClose}>
      <p className="mb-4 text-sm text-muted-foreground">
        {locale === "en" ? "Holder" : "بحوزة"}: {holderName(custody, locale)}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="form-label">{locale === "en" ? "Return date" : "تاريخ الاسترجاع"} *</label>
          <input type="date" value={form.returnedDate} onChange={(e) => setForm((p) => ({ ...p, returnedDate: e.target.value }))} className="input-field" required />
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Condition on return" : "الحالة عند الاسترجاع"}</label>
          <select value={form.conditionOnReturn} onChange={(e) => setForm((p) => ({ ...p, conditionOnReturn: e.target.value }))} className="input-field">
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{locale === "en" ? v.en : v.ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Return status" : "نوع الاسترجاع"}</label>
          <select value={form.custodyStatus} onChange={(e) => setForm((p) => ({ ...p, custodyStatus: e.target.value }))} className="input-field">
            <option value="RETURNED">{locale === "en" ? "Returned normally" : "مُسترجع"}</option>
            <option value="LOST">{locale === "en" ? "Lost" : "مفقود"}</option>
            <option value="DAMAGED">{locale === "en" ? "Damaged" : "تالف"}</option>
          </select>
        </div>
        <div>
          <label className="form-label">{locale === "en" ? "Notes" : "ملاحظات"}</label>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="input-field" rows={2} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            {locale === "en" ? "Cancel" : "إلغاء"}
          </button>
          <button type="submit" disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Confirm return" : "تأكيد الاسترجاع"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Shared Modal wrapper ───────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
