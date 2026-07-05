"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Vehicle {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
}

interface Location {
  id: string;
  nameAr: string;
  nameEn: string | null;
}

interface Category {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  code?: string | null;
  type?: string;
}

interface RevenueRow {
  id: number;
  dbId?: string;
  type: "CASH" | "KNET";
  amount: string;
  description: string;
  date: string;
}

interface ExpenseRow {
  id: number;
  dbId?: string;
  categoryId: string;
  amount: string;
  description: string;
  date: string;
}

const expenseCategoryTypes = [
  { value: "HR", labelAr: "موارد بشرية", labelEn: "HR" },
  { value: "VEHICLE", labelAr: "مركبات", labelEn: "Vehicle" },
  { value: "LEGAL", labelAr: "قانوني / إقامات", labelEn: "Legal / Residency" },
  { value: "UTILITIES", labelAr: "مرافق واتصالات", labelEn: "Utilities" },
  { value: "OPERATIONAL", labelAr: "تشغيلي", labelEn: "Operational" },
  { value: "ADMINISTRATIVE", labelAr: "إداري", labelEn: "Administrative" },
  { value: "OTHER", labelAr: "أخرى", labelEn: "Other" },
];

let nextId = 1000;

export default function EditCarWashOperationPage() {
  const { companyId, operationId } = useParams<{ companyId: string; operationId: string }>();
  const { locale } = useLocale();
  const router = useRouter();
  const ar = locale !== "en";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingCategoryForExpenseId, setAddingCategoryForExpenseId] = useState<number | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [newCategory, setNewCategory] = useState({
    nameAr: "",
    nameEn: "",
    code: "",
    type: "OPERATIONAL",
  });

  const [vehicleId, setVehicleId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [revenues, setRevenues] = useState<RevenueRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/car-wash/vehicles?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/car-wash/locations?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/expenses/categories?companyId=${companyId}`).then((response) => response.json()),
      fetch(`/api/car-wash/operations/${operationId}?companyId=${companyId}`).then((response) => response.json()),
    ])
      .then(([vehiclesPayload, locationsPayload, categoriesPayload, operationPayload]) => {
        if (vehiclesPayload.success) setVehicles(vehiclesPayload.data);
        if (locationsPayload.success) setLocations(locationsPayload.data);
        if (categoriesPayload.success) setCategories(categoriesPayload.data);

        if (operationPayload.success) {
          const op = operationPayload.data;
          setVehicleId(op.vehicleId);
          setLocationId(op.locationId);
          setDate(new Date(op.date).toISOString().slice(0, 10));
          setNotes(op.notes || "");
          setRevenues(
            op.revenues.map((r: any) => ({
              id: nextId++,
              dbId: r.id,
              type: r.type,
              amount: String(r.amount),
              description: r.description || "",
              date: new Date(r.date).toISOString().slice(0, 10),
            }))
          );
          setExpenses(
            op.expenses.map((e: any) => ({
              id: nextId++,
              dbId: e.id,
              categoryId: e.categoryId || "",
              amount: String(e.amount),
              description: e.description,
              date: new Date(e.date).toISOString().slice(0, 10),
            }))
          );
        } else {
          setLoadError(ar ? "تعذر تحميل العملية" : "Failed to load operation");
        }

        setLoading(false);
      })
      .catch(() => {
        setLoadError(ar ? "تعذر تحميل بيانات النموذج" : "Failed to load form data");
        setLoading(false);
      });
  }, [ar, companyId, operationId]);

  function addRevenue() {
    setRevenues((previous) => [
      ...previous,
      { id: nextId++, type: "CASH", amount: "", description: "", date: new Date().toISOString().slice(0, 10) },
    ]);
  }

  function removeRevenue(id: number) {
    setRevenues((previous) => previous.filter((revenue) => revenue.id !== id));
  }

  function setRevField<K extends keyof RevenueRow>(id: number, key: K, value: RevenueRow[K]) {
    setRevenues((previous) => previous.map((revenue) => (revenue.id === id ? { ...revenue, [key]: value } : revenue)));
  }

  function addExpense() {
    setExpenses((previous) => [
      ...previous,
      { id: nextId++, categoryId: categories[0]?.id ?? "", amount: "", description: "", date: new Date().toISOString().slice(0, 10) },
    ]);
  }

  function removeExpense(id: number) {
    setExpenses((previous) => previous.filter((expense) => expense.id !== id));
    if (addingCategoryForExpenseId === id) {
      closeAddCategory();
    }
  }

  function setExpField<K extends keyof ExpenseRow>(id: number, key: K, value: ExpenseRow[K]) {
    setExpenses((previous) => previous.map((expense) => (expense.id === id ? { ...expense, [key]: value } : expense)));
  }

  function openAddCategory(expenseId: number) {
    setCategoryError("");
    setAddingCategoryForExpenseId(expenseId);
    setNewCategory({ nameAr: "", nameEn: "", code: "", type: "OPERATIONAL" });
  }

  function closeAddCategory() {
    setAddingCategoryForExpenseId(null);
    setSavingCategory(false);
    setCategoryError("");
    setNewCategory({ nameAr: "", nameEn: "", code: "", type: "OPERATIONAL" });
  }

  async function handleAddCategory() {
    if (!addingCategoryForExpenseId) return;

    setCategoryError("");
    setSavingCategory(true);
    try {
      const response = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          nameAr: newCategory.nameAr.trim(),
          nameEn: newCategory.nameEn.trim() || undefined,
          code: newCategory.code.trim() || undefined,
          type: newCategory.type,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);

      const createdCategory = payload.data as Category;
      setCategories((previous) =>
        [...previous, createdCategory].sort((left, right) => left.nameAr.localeCompare(right.nameAr, "ar"))
      );
      setExpField(addingCategoryForExpenseId, "categoryId", createdCategory.id);
      closeAddCategory();
    } catch (categoryCreationError) {
      setCategoryError(
        categoryCreationError instanceof Error
          ? categoryCreationError.message
          : ar
            ? "تعذر إنشاء فئة المصروف"
            : "Failed to create expense category"
      );
      setSavingCategory(false);
    }
  }

  const totalCash = revenues
    .filter((revenue) => revenue.type === "CASH")
    .reduce((sum, revenue) => sum + (Number.parseFloat(revenue.amount) || 0), 0);
  const totalKnet = revenues
    .filter((revenue) => revenue.type === "KNET")
    .reduce((sum, revenue) => sum + (Number.parseFloat(revenue.amount) || 0), 0);
  const totalExp = expenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0);
  const net = totalCash + totalKnet - totalExp;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!vehicleId) {
      setError(ar ? "اختر السيارة" : "Select a vehicle");
      return;
    }
    if (!locationId) {
      setError(ar ? "اختر الموقع" : "Select a location");
      return;
    }
    if (revenues.length === 0) {
      setError(ar ? "أضف إيرادًا واحدًا على الأقل" : "Add at least one revenue entry");
      return;
    }

    const revenuePayload = revenues
      .filter((revenue) => Number.parseFloat(revenue.amount) > 0)
      .map((revenue) => ({
        type: revenue.type,
        amount: Number.parseFloat(revenue.amount),
        description: revenue.description || undefined,
        date: revenue.date,
      }));

    const invalidExpense = expenses.find(
      (expense) => Number.parseFloat(expense.amount) > 0 && (!expense.description.trim() || !expense.categoryId)
    );
    if (invalidExpense) {
      setError(ar ? "يرجى استكمال فئة ووصف كل سطر مصروف" : "Please complete category and description for every expense row");
      return;
    }

    const expensePayload = expenses
      .filter((expense) => Number.parseFloat(expense.amount) > 0 && expense.description.trim())
      .map((expense) => ({
        categoryId: expense.categoryId,
        amount: Number.parseFloat(expense.amount),
        description: expense.description,
        date: expense.date,
      }));

    if (revenuePayload.length === 0) {
      setError(ar ? "يجب أن يكون لإيراد واحد على الأقل مبلغ صحيح" : "At least one revenue must have a valid amount");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/car-wash/operations/${operationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          vehicleId,
          locationId,
          date,
          revenues: revenuePayload,
          expenses: expensePayload,
          notes: notes || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      router.push(`/dashboard/companies/${companyId}/car-wash/operations`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : ar ? "حدث خطأ غير متوقع" : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Header
          title={ar ? "تعديل عملية غسيل" : "Edit Car Wash Operation"}
          subtitle={ar ? "جارٍ التحميل..." : "Loading..."}
          companyId={companyId}
        />
        <div className="page-container">
          <p className="text-center text-muted-foreground">{ar ? "جارٍ تحميل البيانات..." : "Loading data..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={ar ? "تعديل عملية غسيل" : "Edit Car Wash Operation"}
        subtitle={ar ? "تحديث الإيرادات والمصروفات" : "Update revenues and expenses"}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/car-wash/operations`}
          className="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {ar ? "العودة للعمليات" : "Back to operations"}
        </Link>

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "السيارة" : "Vehicle"} <span className="text-red-500">*</span>
              </label>
              <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="input-field w-full" required>
                <option value="">{ar ? "اختر السيارة..." : "Select vehicle..."}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.code} - {ar ? vehicle.nameAr : vehicle.nameEn ?? vehicle.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "الموقع" : "Location"} <span className="text-red-500">*</span>
              </label>
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="input-field w-full" required>
                <option value="">{ar ? "اختر الموقع..." : "Select location..."}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {ar ? location.nameAr : location.nameEn ?? location.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "التاريخ" : "Date"} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field w-full" required />
            </div>
          </div>

          <div className="section-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{ar ? "الإيرادات" : "Revenues"}</h3>
              <button type="button" onClick={addRevenue} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                <Plus size={13} />
                {ar ? "إضافة سطر" : "Add row"}
              </button>
            </div>

            {revenues.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{ar ? "لا توجد إيرادات" : "No revenues"}</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <span className="col-span-2">{ar ? "النوع" : "Type"}</span>
                  <span className="col-span-2">{ar ? "التاريخ" : "Date"}</span>
                  <span className="col-span-3">{ar ? "المبلغ (د.ك)" : "Amount (KWD)"}</span>
                  <span className="col-span-4">{ar ? "البيان" : "Description"}</span>
                  <span className="col-span-1" />
                </div>
                {revenues.map((revenue) => (
                  <div key={revenue.id} className="grid grid-cols-12 items-center gap-2">
                    <select
                      value={revenue.type}
                      onChange={(event) => setRevField(revenue.id, "type", event.target.value as "CASH" | "KNET")}
                      className="input-field col-span-2 text-sm"
                    >
                      <option value="CASH">{ar ? "نقدي" : "Cash"}</option>
                      <option value="KNET">KNET</option>
                    </select>
                    <input
                      type="date"
                      required
                      value={revenue.date}
                      onChange={(event) => setRevField(revenue.id, "date", event.target.value)}
                      className="input-field col-span-2 text-sm"
                    />
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={revenue.amount}
                      onChange={(event) => setRevField(revenue.id, "amount", event.target.value)}
                      className="input-field col-span-3 text-sm"
                      dir="ltr"
                    />
                    <input
                      placeholder={ar ? "بيان اختياري" : "Optional note"}
                      value={revenue.description}
                      onChange={(event) => setRevField(revenue.id, "description", event.target.value)}
                      className="input-field col-span-4 text-sm"
                    />
                    <button type="button" onClick={() => removeRevenue(revenue.id)} className="col-span-1 flex justify-center rounded-md p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-6 border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {ar ? "نقدي:" : "Cash:"} <span className="number font-bold text-blue-600">{totalCash.toFixed(3)}</span>
              </span>
              <span className="text-muted-foreground">
                KNET: <span className="number font-bold text-purple-600">{totalKnet.toFixed(3)}</span>
              </span>
            </div>
          </div>

          <div className="section-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{ar ? "المصروفات" : "Expenses"}</h3>
              <button type="button" onClick={addExpense} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                <Plus size={13} />
                {ar ? "إضافة سطر" : "Add row"}
              </button>
            </div>

            {expenses.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{ar ? "لا توجد مصروفات" : "No expenses"}</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <span className="col-span-3">{ar ? "الفئة" : "Category"}</span>
                  <span className="col-span-3">{ar ? "البيان" : "Description"}</span>
                  <span className="col-span-2">{ar ? "التاريخ" : "Date"}</span>
                  <span className="col-span-3">{ar ? "المبلغ (د.ك)" : "Amount (KWD)"}</span>
                  <span className="col-span-1" />
                </div>
                {expenses.map((expense) => (
                  <div key={expense.id} className="space-y-2">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-3 flex items-center gap-2">
                        <select
                          required
                          value={expense.categoryId}
                          onChange={(event) => setExpField(expense.id, "categoryId", event.target.value)}
                          className="input-field flex-1 text-sm"
                        >
                          <option value="">{ar ? "اختر الفئة" : "Select category"}</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {ar ? category.nameAr : category.nameEn ?? category.nameAr}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openAddCategory(expense.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-muted"
                          title={ar ? "إضافة فئة جديدة" : "Add new category"}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <input
                        required
                        placeholder={ar ? "وصف المصروف" : "Expense description"}
                        value={expense.description}
                        onChange={(event) => setExpField(expense.id, "description", event.target.value)}
                        className="input-field col-span-3 text-sm"
                      />
                      <input
                        type="date"
                        required
                        value={expense.date}
                        onChange={(event) => setExpField(expense.id, "date", event.target.value)}
                        className="input-field col-span-2 text-sm"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                        value={expense.amount}
                        onChange={(event) => setExpField(expense.id, "amount", event.target.value)}
                        className="input-field col-span-3 text-sm"
                        dir="ltr"
                      />
                      <button type="button" onClick={() => removeExpense(expense.id)} className="col-span-1 flex justify-center rounded-md p-1 text-destructive hover:bg-destructive/10">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {addingCategoryForExpenseId === expense.id && (
                      <div className="rounded-xl border bg-muted/20 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium">{ar ? "إضافة فئة مصروف جديدة" : "Add new expense category"}</p>
                          <button type="button" onClick={closeAddCategory} className="text-xs text-muted-foreground hover:text-foreground">
                            {ar ? "إلغاء" : "Cancel"}
                          </button>
                        </div>

                        {categoryError && (
                          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {categoryError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input
                            required
                            value={newCategory.nameAr}
                            onChange={(event) => setNewCategory((previous) => ({ ...previous, nameAr: event.target.value }))}
                            className="input-field text-sm"
                            placeholder={ar ? "الاسم بالعربي" : "Arabic name"}
                            autoFocus
                          />
                          <input
                            value={newCategory.nameEn}
                            onChange={(event) => setNewCategory((previous) => ({ ...previous, nameEn: event.target.value }))}
                            className="input-field text-sm"
                            placeholder={ar ? "الاسم بالإنجليزي اختياري" : "English name optional"}
                            dir="ltr"
                          />
                          <select
                            value={newCategory.type}
                            onChange={(event) => setNewCategory((previous) => ({ ...previous, type: event.target.value }))}
                            className="input-field text-sm"
                          >
                            {expenseCategoryTypes.map((typeOption) => (
                              <option key={typeOption.value} value={typeOption.value}>
                                {ar ? typeOption.labelAr : typeOption.labelEn}
                              </option>
                            ))}
                          </select>
                          <input
                            value={newCategory.code}
                            onChange={(event) => setNewCategory((previous) => ({ ...previous, code: event.target.value }))}
                            className="input-field text-sm"
                            placeholder={ar ? "الكود اختياري" : "Code optional"}
                            dir="ltr"
                          />
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddCategory}
                            disabled={savingCategory}
                            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {savingCategory ? (ar ? "جارٍ الحفظ..." : "Saving...") : ar ? "حفظ الفئة" : "Save category"}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {ar ? "سيتم اختيارها تلقائيًا لهذا السطر بعد الحفظ" : "It will be selected automatically for this row"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "إجمالي نقدي" : "Total cash"}</p>
                <p className="number font-bold text-blue-600">
                  {totalCash.toFixed(3)} {ar ? "د.ك" : "KWD"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">KNET</p>
                <p className="number font-bold text-purple-600">
                  {totalKnet.toFixed(3)} {ar ? "د.ك" : "KWD"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "مصروفات" : "Expenses"}</p>
                <p className="number font-bold text-red-600">
                  {totalExp.toFixed(3)} {ar ? "د.ك" : "KWD"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "صافي الإيراد" : "Net revenue"}</p>
                <p className={`number text-lg font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {net.toFixed(3)} {ar ? "د.ك" : "KWD"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{ar ? "ملاحظات" : "Notes"}</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="input-field w-full resize-none" />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : ar ? "حفظ التعديلات" : "Save changes"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/car-wash/operations`} className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {ar ? "إلغاء" : "Cancel"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
