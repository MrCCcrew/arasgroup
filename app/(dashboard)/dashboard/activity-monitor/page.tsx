import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ActivityMonitorClient } from "@/components/activity/activity-monitor-client";
import { hasPermission } from "@/lib/auth/permissions";

export default async function ActivityMonitorPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canViewAll = hasPermission(session, "AUDIT_LOGS", "VIEW");

  if (!canViewAll) {
    return (
      <div>
        <Header title="مراقبة النشاط" />
        <div className="page-container">
          <div className="section-card text-center text-muted-foreground">
            <p>غير مصرح لك بعرض سجلات النشاط</p>
          </div>
        </div>
      </div>
    );
  }

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      email: true,
    },
    orderBy: { nameAr: "asc" },
  });

  return (
    <div>
      <Header
        title="مراقبة النشاط"
        subtitle="عرض وتحليل نشاط الموظفين على أجهزة الكمبيوتر"
      />
      <div className="page-container">
        <ActivityMonitorClient users={users} />
      </div>
    </div>
  );
}
