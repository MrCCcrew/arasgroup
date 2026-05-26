"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { PrintButton } from "@/components/ui/print-button";
import { useLocale } from "@/components/providers/locale-provider";

type TaskStatus = "COMPLETED" | "NOT_COMPLETED" | "DEFERRED";
type PeriodFilter = "all" | "day" | "week" | "month" | "year";

interface Option {
  id: string;
  nameAr: string;
  nameEn?: string | null;
}

interface UserOption extends Option {
  email?: string;
}

interface TaskRecord {
  id: string;
  userId: string;
  companyId?: string | null;
  branchId?: string | null;
  titleAr: string;
  titleEn?: string | null;
  detailsAr?: string | null;
  detailsEn?: string | null;
  taskDate: string;
  departedAt?: string | null;
  returnedAt?: string | null;
  status: TaskStatus;
  deferredToDate?: string | null;
  outcomeNotes?: string | null;
  location?: string | null;
  user: UserOption;
  company?: Option | null;
  branch?: Option | null;
}

interface CompanyOption extends Option {
  branches: Option[];
}

interface Props {
  initialTasks: TaskRecord[];
  users: UserOption[];
  companies: CompanyOption[];
  currentUserId: string;
  canViewAll: boolean;
}

const emptyForm = {
  userId: "",
  companyId: "",
  branchId: "",
  titleAr: "",
  titleEn: "",
  detailsAr: "",
  detailsEn: "",
  taskDate: "",
  departedAt: "",
  returnedAt: "",
  status: "COMPLETED" as TaskStatus,
  deferredToDate: "",
  outcomeNotes: "",
  location: "",
};

export function CompletedTasksManager({
  initialTasks,
  users,
  companies,
  currentUserId,
  canViewAll,
}: Props) {
  const { locale, t } = useLocale();
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const [tasks, setTasks] = useState<TaskRecord[]>(initialTasks);
  const [showForm, setShowForm] = useState(initialTasks.length === 0);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({
    status: "ALL",
    period: "all" as PeriodFilter,
    date: new Date().toISOString().slice(0, 10),
    userId: canViewAll ? "" : currentUserId,
  });
  const [form, setForm] = useState({
    ...emptyForm,
    userId: canViewAll ? "" : currentUserId,
    taskDate: new Date().toISOString().slice(0, 10),
  });

  const branchOptions = useMemo(() => {
    const selectedCompany = companies.find((company) => company.id === form.companyId);
    return selectedCompany?.branches ?? [];
  }, [companies, form.companyId]);

  const visibleTasks = useMemo(() => tasks, [tasks]);

  function localizeName(item?: Option | null) {
    if (!item) return "-";
    return locale === "en" ? item.nameEn ?? item.nameAr : item.nameAr;
  }

  function formatDate(value?: string | null, withTime = false) {
    if (!value) return "-";
    const date = new Date(value);
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-KW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }

  function statusLabel(status: TaskStatus) {
    if (status === "COMPLETED") return t("tasks.completed");
    if (status === "NOT_COMPLETED") return t("tasks.notCompleted");
    return t("tasks.deferred");
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      userId: canViewAll ? "" : currentUserId,
      taskDate: new Date().toISOString().slice(0, 10),
    });
    setEditingTaskId(null);
  }

  async function loadTasks(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("status", nextFilters.status);
      params.set("period", nextFilters.period);
      params.set("date", nextFilters.date);
      if (nextFilters.userId) params.set("userId", nextFilters.userId);

      const response = await fetch(`/api/completed-tasks?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? text("تعذر تحميل المهام", "Failed to load tasks"));
      setTasks(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : text("تعذر تحميل المهام", "Failed to load tasks"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        companyId: form.companyId || null,
        branchId: form.branchId || null,
        deferredToDate: form.deferredToDate || null,
        departedAt: form.departedAt || null,
        returnedAt: form.returnedAt || null,
        userId: canViewAll ? form.userId || currentUserId : currentUserId,
      };

      const response = await fetch(editingTaskId ? `/api/completed-tasks/${editingTaskId}` : "/api/completed-tasks", {
        method: editingTaskId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? text("تعذر حفظ المهمة", "Failed to save task"));

      setSuccess(editingTaskId ? text("تم تحديث المهمة بنجاح", "Task updated successfully") : text("تم حفظ المهمة بنجاح", "Task saved successfully"));
      resetForm();
      setShowForm(false);
      await loadTasks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("تعذر حفظ المهمة", "Failed to save task"));
    } finally {
      setLoading(false);
    }
  }

  function startEdit(task: TaskRecord) {
    setEditingTaskId(task.id);
    setShowForm(true);
    setForm({
      userId: task.userId,
      companyId: task.companyId ?? "",
      branchId: task.branchId ?? "",
      titleAr: task.titleAr,
      titleEn: task.titleEn ?? "",
      detailsAr: task.detailsAr ?? "",
      detailsEn: task.detailsEn ?? "",
      taskDate: task.taskDate.slice(0, 10),
      departedAt: task.departedAt ? task.departedAt.slice(0, 16) : "",
      returnedAt: task.returnedAt ? task.returnedAt.slice(0, 16) : "",
      status: task.status,
      deferredToDate: task.deferredToDate ? task.deferredToDate.slice(0, 10) : "",
      outcomeNotes: task.outcomeNotes ?? "",
      location: task.location ?? "",
    });
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm(text("هل تريد حذف هذه المهمة؟", "Do you want to delete this task?"))) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/completed-tasks/${taskId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? text("تعذر حذف المهمة", "Failed to delete task"));
      setSuccess(text("تم حذف المهمة", "Task deleted"));
      await loadTasks();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : text("تعذر حذف المهمة", "Failed to delete task"));
    } finally {
      setLoading(false);
    }
  }

  const statusSummary = {
    completed: visibleTasks.filter((task) => task.status === "COMPLETED").length,
    notCompleted: visibleTasks.filter((task) => task.status === "NOT_COMPLETED").length,
    deferred: visibleTasks.filter((task) => task.status === "DEFERRED").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon={<ClipboardCheck size={18} className="text-emerald-600" />} title={text("إجمالي المهام", "Total tasks")} value={visibleTasks.length} />
        <SummaryCard icon={<ClipboardCheck size={18} className="text-green-600" />} title={t("tasks.completed")} value={statusSummary.completed} />
        <SummaryCard icon={<CalendarClock size={18} className="text-amber-600" />} title={t("tasks.notCompleted")} value={statusSummary.notCompleted} />
        <SummaryCard icon={<CalendarClock size={18} className="text-blue-600" />} title={t("tasks.deferred")} value={statusSummary.deferred} />
      </div>

      <div className="section-card no-print space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold">{t("tasks.pageTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("tasks.pageSubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm((current) => !current);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {t("tasks.addTask")}
            </button>
            <PrintButton label={t("tasks.print")} />
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <SelectField
            label={t("tasks.period")}
            value={filters.period}
            onChange={(value) => setFilters((prev) => ({ ...prev, period: value as PeriodFilter }))}
            options={[
              { value: "all", label: t("tasks.allPeriods") },
              { value: "day", label: t("tasks.daily") },
              { value: "week", label: t("tasks.weekly") },
              { value: "month", label: t("tasks.monthly") },
              { value: "year", label: t("tasks.yearly") },
            ]}
          />
          <Field label={t("tasks.taskDate")}>
            <input type="date" className="input-field w-full" value={filters.date} onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))} />
          </Field>
          <SelectField
            label={t("tasks.status")}
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={[
              { value: "ALL", label: text("كل الحالات", "All statuses") },
              { value: "COMPLETED", label: t("tasks.completed") },
              { value: "NOT_COMPLETED", label: t("tasks.notCompleted") },
              { value: "DEFERRED", label: t("tasks.deferred") },
            ]}
          />
          <div className="space-y-1.5">
            {canViewAll ? (
              <SelectField
                label={t("tasks.user")}
                value={filters.userId}
                onChange={(value) => setFilters((prev) => ({ ...prev, userId: value }))}
                options={[
                  { value: "", label: t("tasks.allUsers") },
                  ...users.map((user) => ({ value: user.id, label: localizeName(user) })),
                ]}
              />
            ) : (
              <div className="flex h-full items-end">
                <button
                  type="button"
                  onClick={() => loadTasks()}
                  className="w-full rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  {loading ? text("جارٍ التحديث...", "Refreshing...") : text("تحديث القائمة", "Refresh list")}
                </button>
              </div>
            )}
          </div>
        </div>

        {canViewAll ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadTasks()}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              {loading ? text("جارٍ التحديث...", "Refreshing...") : text("تطبيق الفلاتر", "Apply filters")}
            </button>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={handleSave} className="section-card no-print space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{editingTaskId ? t("tasks.editTask") : t("tasks.addTask")}</h3>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-sm text-muted-foreground hover:text-foreground">
              {text("إغلاق", "Close")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {canViewAll ? (
              <SelectField
                label={t("tasks.user")}
                value={form.userId}
                onChange={(value) => setForm((prev) => ({ ...prev, userId: value }))}
                options={users.map((user) => ({ value: user.id, label: localizeName(user) }))}
              />
            ) : null}
            <Field label={t("tasks.company")}>
              <select className="input-field w-full" value={form.companyId} onChange={(event) => setForm((prev) => ({ ...prev, companyId: event.target.value, branchId: "" }))}>
                <option value="">{text("بدون تحديد", "Not specified")}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{localizeName(company)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("tasks.branch")}>
              <select className="input-field w-full" value={form.branchId} onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))}>
                <option value="">{text("بدون تحديد", "Not specified")}</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{localizeName(branch)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("tasks.taskDate")} required>
              <input type="date" className="input-field w-full" value={form.taskDate} onChange={(event) => setForm((prev) => ({ ...prev, taskDate: event.target.value }))} required />
            </Field>
            <Field label={t("tasks.titleAr")} required>
              <input className="input-field w-full" value={form.titleAr} onChange={(event) => setForm((prev) => ({ ...prev, titleAr: event.target.value }))} required />
            </Field>
            <Field label={t("tasks.titleEn")}>
              <input className="input-field w-full" dir="ltr" value={form.titleEn} onChange={(event) => setForm((prev) => ({ ...prev, titleEn: event.target.value }))} />
            </Field>
            <Field label={t("tasks.departedAt")}>
              <input type="datetime-local" className="input-field w-full" value={form.departedAt} onChange={(event) => setForm((prev) => ({ ...prev, departedAt: event.target.value }))} />
            </Field>
            <Field label={t("tasks.returnedAt")}>
              <input type="datetime-local" className="input-field w-full" value={form.returnedAt} onChange={(event) => setForm((prev) => ({ ...prev, returnedAt: event.target.value }))} />
            </Field>
            <Field label={t("tasks.location")}>
              <input className="input-field w-full" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />
            </Field>
            <SelectField
              label={t("tasks.status")}
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value as TaskStatus }))}
              options={[
                { value: "COMPLETED", label: t("tasks.completed") },
                { value: "NOT_COMPLETED", label: t("tasks.notCompleted") },
                { value: "DEFERRED", label: t("tasks.deferred") },
              ]}
            />
            <Field label={t("tasks.deferredToDate")}>
              <input type="date" className="input-field w-full" value={form.deferredToDate} onChange={(event) => setForm((prev) => ({ ...prev, deferredToDate: event.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t("tasks.detailsAr")}>
              <textarea className="input-field min-h-28 w-full" value={form.detailsAr} onChange={(event) => setForm((prev) => ({ ...prev, detailsAr: event.target.value }))} />
            </Field>
            <Field label={t("tasks.detailsEn")}>
              <textarea className="input-field min-h-28 w-full" dir="ltr" value={form.detailsEn} onChange={(event) => setForm((prev) => ({ ...prev, detailsEn: event.target.value }))} />
            </Field>
          </div>

          <Field label={t("tasks.outcomeNotes")}>
            <textarea className="input-field min-h-24 w-full" value={form.outcomeNotes} onChange={(event) => setForm((prev) => ({ ...prev, outcomeNotes: event.target.value }))} />
          </Field>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? text("جارٍ الحفظ...", "Saving...") : editingTaskId ? t("tasks.update") : t("tasks.save")}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              {text("إلغاء", "Cancel")}
            </button>
          </div>
        </form>
      ) : null}

      <div className="section-card">
        <div className="print-only mb-4 border-b pb-3">
          <h1 className="text-xl font-bold">{t("tasks.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("tasks.filtersSummary")}: {t(`tasks.${filters.period === "all" ? "allPeriods" : filters.period === "day" ? "daily" : filters.period === "week" ? "weekly" : filters.period === "month" ? "monthly" : "yearly"}`)}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-right">{t("tasks.taskDate")}</th>
                <th className="px-3 py-3 text-right">{t("tasks.user")}</th>
                <th className="px-3 py-3 text-right">{text("العنوان", "Title")}</th>
                <th className="px-3 py-3 text-right">{t("tasks.company")}</th>
                <th className="px-3 py-3 text-right">{t("tasks.branch")}</th>
                <th className="px-3 py-3 text-right">{t("tasks.status")}</th>
                <th className="px-3 py-3 text-right">{text("التوقيت", "Timing")}</th>
                <th className="px-3 py-3 text-right no-print">{text("إجراءات", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{t("tasks.noTasks")}</td>
                </tr>
              ) : (
                visibleTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border/50 align-top">
                    <td className="px-3 py-3">{formatDate(task.taskDate)}</td>
                    <td className="px-3 py-3">{localizeName(task.user)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{locale === "en" ? task.titleEn || task.titleAr : task.titleAr}</div>
                      {task.location ? <div className="text-xs text-muted-foreground">{task.location}</div> : null}
                    </td>
                    <td className="px-3 py-3">{localizeName(task.company)}</td>
                    <td className="px-3 py-3">{localizeName(task.branch)}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">{statusLabel(task.status)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div>{t("tasks.departedAt")}: {formatDate(task.departedAt, true)}</div>
                      <div>{t("tasks.returnedAt")}: {formatDate(task.returnedAt, true)}</div>
                    </td>
                    <td className="px-3 py-3 no-print">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEdit(task)} className="rounded-lg border p-2 hover:bg-muted" aria-label={t("tasks.editTask")}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => handleDelete(task.id)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50" aria-label={t("tasks.delete")}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Field label={label}>
      <select className="input-field w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

function SummaryCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}
