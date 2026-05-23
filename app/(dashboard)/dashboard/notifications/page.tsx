"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { RefreshCw } from "lucide-react";

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

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  SENT: "مُرسل",
  READ: "مقروء",
  RESOLVED: "محلول",
  DISMISSED: "مُغلق",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  WARNING: "bg-orange-100 text-orange-700",
  INFO: "bg-blue-100 text-blue-700",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notifications?limit=200").then((r) => r.json()).catch(() => null);
    if (res?.success) {
      const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setNotifications(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function regenerate() {
    setRegenerating(true);
    setRegenResult(null);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        const parts = [];
        if (d.employees) parts.push(`${d.employees} موظف`);
        if (d.licenses) parts.push(`${d.licenses} ترخيص`);
        if (d.vehicles) parts.push(`${d.vehicles} مركبة`);
        if (d.investorClaims) parts.push(`${d.investorClaims} مطالبة`);
        if (d.investorSalaryCollections) parts.push(`${d.investorSalaryCollections} تحصيل`);
        setRegenResult(
          parts.length > 0
            ? `تم توليد إشعارات: ${parts.join("، ")}`
            : "تم التحقق — لا توجد إشعارات جديدة حالياً"
        );
        await load();
        router.refresh();
      } else {
        setRegenResult(`خطأ: ${data.error ?? "فشل التوليد"}`);
      }
    } catch {
      setRegenResult("حدث خطأ في الاتصال");
    }
    setRegenerating(false);
  }

  const pendingCount = notifications.filter((n) => n.status === "PENDING").length;
  const criticalCount = notifications.filter((n) => n.severity === "CRITICAL").length;

  return (
    <div>
      <Header
        title="مركز الإشعارات"
        subtitle="تنبيهات الانتهاء والمواعيد المهمة"
        actions={
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
            {regenerating ? "جاري التوليد..." : "إعادة توليد الإشعارات"}
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Result message */}
        {regenResult && (
          <div className={`rounded-xl p-3 text-sm ${regenResult.startsWith("خطأ") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {regenResult}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي الإشعارات</p>
            <p className="mt-1 text-2xl font-bold">{notifications.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">معلقة</p>
            <p className={`mt-1 text-2xl font-bold ${pendingCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{pendingCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">حرجة</p>
            <p className={`mt-1 text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{criticalCount}</p>
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
                    <th>العنوان</th>
                    <th>الوصف</th>
                    <th>النوع</th>
                    <th>الأهمية</th>
                    <th>الحالة</th>
                    <th>الاستحقاق</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        لا توجد إشعارات حالياً — اضغط "إعادة توليد" لإنشائها
                      </td>
                    </tr>
                  ) : notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-muted/30">
                      <td className="font-medium">{n.titleAr}</td>
                      <td className="max-w-xs truncate text-sm text-muted-foreground">{n.messageAr ?? "—"}</td>
                      <td className="font-mono text-xs">{n.type}</td>
                      <td>
                        {n.severity ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[n.severity] ?? "bg-gray-100 text-gray-600"}`}>
                            {n.severity === "CRITICAL" ? "حرج" : n.severity === "WARNING" ? "تحذير" : "معلومة"}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === "PENDING" ? "bg-amber-100 text-amber-700" : n.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[n.status] ?? n.status}
                        </span>
                      </td>
                      <td className="text-sm">
                        {n.dueDate
                          ? <span className={(() => { const d = Math.floor((new Date(n.dueDate).getTime() - Date.now()) / 86400000); return d < 0 ? "text-red-600 font-medium" : d <= 30 ? "text-orange-500 font-medium" : ""; })()}>
                              {new Date(n.dueDate).toLocaleDateString("ar-KW")}
                            </span>
                          : "—"}
                      </td>
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
