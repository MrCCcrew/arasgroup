"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { RefreshCw, Trash2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface Notification {
  id: string;
  titleAr: string;
  titleEn: string | null;
  messageAr: string | null;
  messageEn: string | null;
  type: string;
  status: string;
  severity: string | null;
  dueDate: string | null;
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: "معلق", en: "Pending" },
  UNREAD: { ar: "غير مقروء", en: "Unread" },
  SENT: { ar: "مرسل", en: "Sent" },
  READ: { ar: "مقروء", en: "Read" },
  RESOLVED: { ar: "محلول", en: "Resolved" },
  DISMISSED: { ar: "مغلق", en: "Dismissed" },
};

const SEVERITY_META: Record<string, { ar: string; en: string; className: string }> = {
  CRITICAL: { ar: "حرج", en: "Critical", className: "bg-red-100 text-red-700" },
  DANGER: { ar: "حرج", en: "Critical", className: "bg-red-100 text-red-700" },
  WARNING: { ar: "تحذير", en: "Warning", className: "bg-orange-100 text-orange-700" },
  INFO: { ar: "معلومة", en: "Info", className: "bg-blue-100 text-blue-700" },
  SUCCESS: { ar: "نجاح", en: "Success", className: "bg-green-100 text-green-700" },
};

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  RESIDENCY_EXPIRY: { ar: "انتهاء الإقامة", en: "Residency expiry" },
  PASSPORT_EXPIRY: { ar: "انتهاء جواز السفر", en: "Passport expiry" },
  COMMERCIAL_LICENSE_EXPIRY: { ar: "انتهاء الترخيص التجاري", en: "Commercial license expiry" },
  VEHICLE_INSURANCE_EXPIRY: { ar: "انتهاء تأمين المركبة", en: "Vehicle insurance expiry" },
  INVESTOR_CLAIM_DUE: { ar: "استحقاق مطالبة مسؤول", en: "Investor claim due" },
  INVESTOR_SALARY_COLLECTION_DUE: { ar: "استحقاق تحصيل رواتب المستثمرين", en: "Investor salary collection due" },
  FINANCIAL_CLAIM_SENT: { ar: "إرسال مطالبة مالية", en: "Financial claim sent" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const en = locale === "en";
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [regenResult, setRegenResult] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notifications?limit=200").then((r) => r.json()).catch(() => null);
    if (res?.success) {
      const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setNotifications(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;

    async function loadViewer() {
      const res = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!active || !res?.success) return;
      setIsSuperAdmin(Boolean(res.data?.isSuperAdmin));
    }

    loadViewer();
    return () => {
      active = false;
    };
  }, []);

  async function regenerate() {
    setRegenerating(true);
    setRegenResult(null);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        const parts = [];
        if (d.employees) parts.push(`${d.employees} ${en ? "employee" : "موظف"}`);
        if (d.licenses) parts.push(`${d.licenses} ${en ? "license" : "ترخيص"}`);
        if (d.vehicles) parts.push(`${d.vehicles} ${en ? "vehicle" : "مركبة"}`);
        if (d.investorClaims) parts.push(`${d.investorClaims} ${en ? "claim" : "مطالبة"}`);
        if (d.investorSalaryCollections) parts.push(`${d.investorSalaryCollections} ${en ? "collection" : "تحصيل"}`);
        setRegenResult(
          parts.length > 0
            ? (en ? `Notifications generated: ${parts.join(", ")}` : `تم توليد إشعارات: ${parts.join("، ")}`)
            : (en ? "Checked successfully - there are no new notifications right now." : "تم التحقق - لا توجد إشعارات جديدة حالياً")
        );
        await load();
        router.refresh();
      } else {
        setRegenResult(en ? `Error: ${data.error ?? "Generation failed"}` : `خطأ: ${data.error ?? "فشل التوليد"}`);
      }
    } catch {
      setRegenResult(en ? "A connection error occurred." : "حدث خطأ في الاتصال");
    }
    setRegenerating(false);
  }

  async function deleteNotification(notificationId: string) {
    const confirmed = window.confirm(
      en ? "Do you want to delete this notification?" : "هل تريد حذف هذا الإشعار؟",
    );
    if (!confirmed) return;

    setDeletingId(notificationId);
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        window.alert(data?.error ?? (en ? "Delete failed" : "فشل حذف الإشعار"));
        return;
      }

      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } catch {
      window.alert(en ? "A connection error occurred." : "حدث خطأ في الاتصال");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAllNotifications() {
    const confirmed = window.confirm(
      en ? "Do you want to delete all notifications?" : "هل تريد حذف كل الإشعارات؟",
    );
    if (!confirmed) return;

    setDeletingAll(true);
    setRegenResult(null);
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        window.alert(data?.error ?? (en ? "Delete all failed" : "فشل حذف كل الإشعارات"));
        return;
      }

      setNotifications([]);
      const count = Number(data.data?.deletedCount ?? 0);
      setRegenResult(
        en ? `Deleted ${count} notification(s).` : `تم حذف ${count} إشعار.`,
      );
    } catch {
      window.alert(en ? "A connection error occurred." : "حدث خطأ في الاتصال");
    } finally {
      setDeletingAll(false);
    }
  }

  const pendingCount = notifications.filter((n) => n.status === "PENDING").length;
  const criticalCount = notifications.filter((n) => n.severity === "CRITICAL" || n.severity === "DANGER").length;
  const columnCount = isSuperAdmin ? 7 : 6;

  const rows = useMemo(() => notifications.map((notification) => {
    const typeLabel = TYPE_LABELS[notification.type];
    const severityMeta = notification.severity ? SEVERITY_META[notification.severity] : null;
    const statusLabel = STATUS_LABELS[notification.status];

    return {
      ...notification,
      typeLabel: en ? typeLabel?.en ?? notification.type : typeLabel?.ar ?? notification.type,
      severityLabel: severityMeta ? (en ? severityMeta.en : severityMeta.ar) : null,
      severityClassName: severityMeta?.className ?? "bg-gray-100 text-gray-600",
      statusLabel: en ? statusLabel?.en ?? notification.status : statusLabel?.ar ?? notification.status,
      title: en ? notification.titleEn ?? notification.titleAr : notification.titleAr,
      message: en ? notification.messageEn ?? notification.messageAr : notification.messageAr,
    };
  }), [en, notifications]);

  return (
    <div>
      <Header
        title={en ? "Notification Center" : "مركز الإشعارات"}
        subtitle={en ? "Expiry alerts and important deadlines" : "تنبيهات الانتهاء والمواعيد المهمة"}
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin ? (
              <button
                onClick={deleteAllNotifications}
                disabled={deletingAll || notifications.length === 0}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {deletingAll ? (en ? "Deleting..." : "جاري الحذف...") : (en ? "Delete all" : "حذف الكل")}
              </button>
            ) : null}
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? (en ? "Regenerating..." : "جاري التوليد...") : (en ? "Regenerate notifications" : "إعادة توليد الإشعارات")}
            </button>
          </div>
        }
      />

      <div className="page-container space-y-4">
        {regenResult && (
          <div className={`rounded-xl p-3 text-sm ${regenResult.startsWith("Error:") || regenResult.startsWith("خطأ:") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {regenResult}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{en ? "Total notifications" : "إجمالي الإشعارات"}</p>
            <p className="mt-1 text-2xl font-bold">{notifications.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{en ? "Pending" : "معلقة"}</p>
            <p className={`mt-1 text-2xl font-bold ${pendingCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{pendingCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{en ? "Critical" : "حرجة"}</p>
            <p className={`mt-1 text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{criticalCount}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{en ? "Loading..." : "جاري التحميل..."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{en ? "Title" : "العنوان"}</th>
                    <th>{en ? "Description" : "الوصف"}</th>
                    <th>{en ? "Type" : "النوع"}</th>
                    <th>{en ? "Priority" : "الأهمية"}</th>
                    <th>{en ? "Status" : "الحالة"}</th>
                    <th>{en ? "Due date" : "الاستحقاق"}</th>
                    {isSuperAdmin ? <th>{en ? "Actions" : "إجراءات"}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="py-10 text-center text-muted-foreground">
                        {en ? 'No notifications right now - press "Regenerate" to create them.' : 'لا توجد إشعارات حالياً - اضغط "إعادة توليد" لإنشائها'}
                      </td>
                    </tr>
                  ) : rows.map((n) => (
                    <tr key={n.id} className="hover:bg-muted/30">
                      <td className="font-medium">{n.title}</td>
                      <td className="max-w-xs truncate text-sm text-muted-foreground">{n.message ?? "—"}</td>
                      <td className="text-sm">{n.typeLabel}</td>
                      <td>
                        {n.severityLabel ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${n.severityClassName}`}>
                            {n.severityLabel}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === "PENDING" ? "bg-amber-100 text-amber-700" : n.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {n.statusLabel}
                        </span>
                      </td>
                      <td className="text-sm">
                        {n.dueDate ? (
                          <span
                            className={(() => {
                              const days = Math.floor((new Date(n.dueDate).getTime() - Date.now()) / 86400000);
                              return days < 0 ? "text-red-600 font-medium" : days <= 30 ? "text-orange-500 font-medium" : "";
                            })()}
                          >
                            {new Date(n.dueDate).toLocaleDateString(en ? "en-GB" : "ar-KW")}
                          </span>
                        ) : "—"}
                      </td>
                      {isSuperAdmin ? (
                        <td>
                          <button
                            type="button"
                            onClick={() => deleteNotification(n.id)}
                            disabled={deletingId === n.id}
                            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title={en ? "Delete notification" : "حذف الإشعار"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
