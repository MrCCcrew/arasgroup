"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Monitor, TrendingUp, Globe, Loader2 } from "lucide-react";

interface User {
  id: string;
  nameAr: string;
  nameEn: string | null;
  email: string;
}

interface ActivityLog {
  id: string;
  activityType: string;
  windowTitle: string | null;
  applicationName: string | null;
  url: string | null;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  isIdle: boolean;
  deviceName: string | null;
  screenshotUrl: string | null;
  user: User;
}

interface Stats {
  totalLogs: number;
  totalActiveTime: string;
  totalIdleTime: string;
  productivityPercentage: number;
  topApplications: { name: string; seconds: number }[];
  topWebsites: { name: string; seconds: number }[];
  activityByType: Record<string, number>;
}

export function ActivityMonitorClient({ users }: { users: User[] }) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  // Fetch logs when filters change
  useEffect(() => {
    if (selectedUserId && startDate) {
      fetchLogs();
      fetchStats();
    }
  }, [selectedUserId, startDate, endDate]);

  async function fetchLogs() {
    if (!selectedUserId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: selectedUserId,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        limit: "200",
      });

      const res = await fetch(`/api/activity-logs?${params}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    if (!selectedUserId) return;

    setStatsLoading(true);
    try {
      const params = new URLSearchParams({
        userId: selectedUserId,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const res = await fetch(`/api/activity-logs/stats?${params}`);
      const data = await res.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }

  const activityTypeLabels: Record<string, string> = {
    WINDOW_CHANGE: "تغيير النافذة",
    WEBSITE_VISIT: "زيارة موقع",
    APPLICATION_USE: "استخدام برنامج",
    IDLE: "عدم نشاط",
    ACTIVE: "نشط",
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="section-card">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="form-label">الموظف *</label>
            <select
              className="input-field w-full"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">اختر موظف</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">من تاريخ</label>
            <input
              type="date"
              className="input-field w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">إلى تاريخ</label>
            <input
              type="date"
              className="input-field w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedUserId && stats && !statsLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="section-card">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Clock size={18} />
              <h3 className="text-sm font-medium">إجمالي الوقت النشط</h3>
            </div>
            <p className="text-2xl font-bold">{stats.totalActiveTime}</p>
          </div>

          <div className="section-card">
            <div className="mb-2 flex items-center gap-2 text-orange-500">
              <Calendar size={18} />
              <h3 className="text-sm font-medium">وقت عدم النشاط</h3>
            </div>
            <p className="text-2xl font-bold">{stats.totalIdleTime}</p>
          </div>

          <div className="section-card">
            <div className="mb-2 flex items-center gap-2 text-green-500">
              <TrendingUp size={18} />
              <h3 className="text-sm font-medium">نسبة الإنتاجية</h3>
            </div>
            <p className="text-2xl font-bold">{stats.productivityPercentage}%</p>
          </div>

          <div className="section-card">
            <div className="mb-2 flex items-center gap-2 text-blue-500">
              <Monitor size={18} />
              <h3 className="text-sm font-medium">عدد السجلات</h3>
            </div>
            <p className="text-2xl font-bold">{stats.totalLogs}</p>
          </div>
        </div>
      )}

      {/* Top Apps and Websites */}
      {selectedUserId && stats && !statsLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Applications */}
          <div className="section-card">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Monitor size={16} />
              أكثر البرامج استخداماً
            </h3>
            <div className="space-y-2">
              {stats.topApplications.slice(0, 5).map((app, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate">{app.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatSeconds(app.seconds)}
                  </span>
                </div>
              ))}
              {stats.topApplications.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">لا توجد بيانات</p>
              )}
            </div>
          </div>

          {/* Top Websites */}
          <div className="section-card">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Globe size={16} />
              أكثر المواقع زيارة
            </h3>
            <div className="space-y-2">
              {stats.topWebsites.slice(0, 5).map((site, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate">{site.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatSeconds(site.seconds)}
                  </span>
                </div>
              ))}
              {stats.topWebsites.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">لا توجد بيانات</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Table */}
      {selectedUserId && (
        <div className="section-card">
          <h3 className="mb-4 text-sm font-semibold">سجل النشاط التفصيلي</h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              لا توجد سجلات نشاط لهذا الموظف في الفترة المحددة
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>الوقت</th>
                    <th>النوع</th>
                    <th>البرنامج</th>
                    <th>العنوان</th>
                    <th>الرابط</th>
                    <th>المدة</th>
                    <th>الجهاز</th>
                    <th>لقطة الشاشة</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className={log.isIdle ? "opacity-50" : ""}>
                      <td className="whitespace-nowrap text-xs">
                        {new Date(log.startTime).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            log.isIdle
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {activityTypeLabels[log.activityType] || log.activityType}
                        </span>
                      </td>
                      <td>{log.applicationName || "—"}</td>
                      <td className="max-w-xs truncate">{log.windowTitle || "—"}</td>
                      <td className="max-w-xs truncate text-xs">
                        {log.url ? (
                          <a
                            href={log.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {new URL(log.url).hostname}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs">
                        {log.durationSeconds ? formatSeconds(log.durationSeconds) : "—"}
                      </td>
                      <td className="text-xs text-muted-foreground">{log.deviceName || "—"}</td>
                      <td>
                        {log.screenshotUrl ? (
                          <a
                            href={log.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs"
                          >
                            عرض 📸
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedUserId && (
        <div className="section-card text-center text-muted-foreground">
          <p>اختر موظف لعرض سجل نشاطه</p>
        </div>
      )}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  } else if (minutes > 0) {
    return `${minutes}د`;
  } else {
    return `${secs}ث`;
  }
}
