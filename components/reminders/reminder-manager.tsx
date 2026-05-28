"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, Circle, Clock, Plus, Trash2, X, AlertCircle } from "lucide-react";

interface Reminder {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string;
  reminderMinutes: number;
  isCompleted: boolean;
  completedAt: string | null;
  notifiedAt: string | null;
}

interface Props {
  initialReminders: Reminder[];
  userId: string;
}

const REMINDER_OPTIONS = [
  { value: 0,    label: "عند الموعد" },
  { value: 5,    label: "قبل 5 دقائق" },
  { value: 10,   label: "قبل 10 دقائق" },
  { value: 15,   label: "قبل 15 دقيقة" },
  { value: 30,   label: "قبل 30 دقيقة" },
  { value: 60,   label: "قبل ساعة" },
  { value: 120,  label: "قبل ساعتين" },
  { value: 1440, label: "قبل يوم" },
];

function toLocalDatetimeValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDueAt(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const mins = Math.round(absDiff / 60000);
  const hours = Math.round(absDiff / 3600000);
  const days = Math.round(absDiff / 86400000);

  const dateStr = d.toLocaleDateString("ar-KW", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = d.toLocaleTimeString("ar-KW", { hour: "2-digit", minute: "2-digit" });

  let relative = "";
  if (diff < -60000) {
    if (mins < 60) relative = `تأخر ${mins} دقيقة`;
    else if (hours < 24) relative = `تأخر ${hours} ساعة`;
    else relative = `تأخر ${days} يوم`;
  } else if (diff < 60000) {
    relative = "الآن";
  } else {
    if (mins < 60) relative = `خلال ${mins} دقيقة`;
    else if (hours < 24) relative = `خلال ${hours} ساعة`;
    else relative = `خلال ${days} يوم`;
  }

  return `${dateStr} ${timeStr} — ${relative}`;
}

function isOverdue(isoString: string) {
  return new Date(isoString) < new Date();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function ReminderManager({ initialReminders, userId: _userId }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setSeconds(0);
    return toLocalDatetimeValue(d.toISOString());
  });
  const [reminderMinutes, setReminderMinutes] = useState(15);

  const [pushStatus, setPushStatus] = useState<"unknown" | "unsupported" | "denied" | "granted" | "loading">("unknown");
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      swRef.current = reg;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setPushEndpoint(sub.endpoint);
        setPushStatus("granted");
      } else if (Notification.permission === "granted") {
        setPushStatus("granted");
      } else {
        setPushStatus("unknown");
      }
    });
  }, []);

  async function enablePush() {
    setPushStatus("loading");
    setError("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushStatus("denied");
        return;
      }
      const reg = swRef.current ?? (await navigator.serviceWorker.ready);
      swRef.current = reg;

      const keyRes = await fetch("/api/push/subscribe");
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        setError("مفاتيح VAPID غير مهيأة — أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY في ملف .env");
        setPushStatus("unknown");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
      });

      setPushEndpoint(json.endpoint);
      setPushStatus("granted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تفعيل الإشعارات");
      setPushStatus("unknown");
    }
  }

  async function disablePush() {
    const reg = swRef.current ?? (await navigator.serviceWorker.ready);
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    }
    setPushEndpoint(null);
    setPushStatus("unknown");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes: notes || undefined,
          dueAt: new Date(dueAt).toISOString(),
          reminderMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReminders((prev) =>
        [...prev, data.data].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
      );
      setTitle("");
      setNotes("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في حفظ التذكير");
    } finally {
      setFormLoading(false);
    }
  }

  async function toggleComplete(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !r.isCompleted }),
    });
    const data = await res.json();
    if (res.ok) setReminders((prev) => prev.map((x) => (x.id === r.id ? data.data : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذا التذكير؟")) return;
    const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    if (res.ok) setReminders((prev) => prev.filter((x) => x.id !== id));
  }

  const visible = reminders.filter((r) => showCompleted || !r.isCompleted);
  const pending = reminders.filter((r) => !r.isCompleted);
  const overdueCount = pending.filter((r) => isOverdue(r.dueAt)).length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {pushStatus === "unsupported" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertCircle size={13} /> المتصفح لا يدعم الإشعارات
            </span>
          )}
          {pushStatus === "denied" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <BellOff size={13} /> الإشعارات محظورة — فعّلها من إعدادات المتصفح
            </span>
          )}
          {pushStatus === "loading" && (
            <span className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              <Bell size={13} /> جارٍ التفعيل...
            </span>
          )}
          {pushStatus === "granted" && pushEndpoint && (
            <button
              onClick={disablePush}
              className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 hover:bg-green-100"
            >
              <Bell size={13} /> إشعارات ويندوز مفعلة — إلغاء
            </button>
          )}
          {pushStatus === "unknown" && (
            <button
              onClick={enablePush}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
            >
              <Bell size={13} /> تفعيل إشعارات ويندوز
            </button>
          )}
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              <AlertCircle size={12} /> {overdueCount} متأخر
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            عرض المنجزة
          </label>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? "إغلاق" : "تذكير جديد"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* New reminder form */}
      {showForm && (
        <form onSubmit={handleCreate} className="section-card space-y-4">
          <h2 className="font-semibold">إضافة تذكير جديد</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                العنوان <span className="text-red-500">*</span>
              </label>
              <input
                className="input-field w-full"
                placeholder="مثال: مراجعة الرواتب، تجديد رخصة الشركة…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                الموعد <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="input-field w-full"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">وقت التذكير</label>
              <select
                className="input-field w-full"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">ملاحظات</label>
              <textarea
                className="input-field w-full resize-none"
                rows={2}
                placeholder="تفاصيل اختيارية…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={formLoading}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {formLoading ? "جارٍ الحفظ..." : "حفظ التذكير"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-5 py-2 text-sm hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Reminders list */}
      {visible.length === 0 ? (
        <div className="section-card py-16 text-center text-muted-foreground">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p>
            {showCompleted
              ? "لا توجد تذكيرات"
              : "لا توجد تذكيرات قادمة — أضف تذكيراً جديداً"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const overdue = !r.isCompleted && isOverdue(r.dueAt);
            return (
              <div
                key={r.id}
                className={`flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors ${
                  r.isCompleted ? "opacity-60" : overdue ? "border-red-200 bg-red-50/40" : ""
                }`}
              >
                <button
                  onClick={() => toggleComplete(r)}
                  className={`mt-0.5 shrink-0 transition-colors ${
                    r.isCompleted ? "text-green-500" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {r.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${r.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {r.title}
                  </p>
                  {r.notes && <p className="mt-0.5 text-sm text-muted-foreground">{r.notes}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={`flex items-center gap-1 ${overdue ? "font-medium text-red-600" : ""}`}>
                      <Clock size={11} />
                      {formatDueAt(r.dueAt)}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {REMINDER_OPTIONS.find((o) => o.value === r.reminderMinutes)?.label ??
                        `قبل ${r.reminderMinutes} دقيقة`}
                    </span>
                    {r.notifiedAt && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Bell size={11} /> أُرسل الإشعار
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(r.id)}
                  className="shrink-0 rounded-lg border p-1.5 text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {pending.length} تذكير قادم • يتم إرسال الإشعارات تلقائياً قبل الموعد المحدد
      </p>
    </div>
  );
}
