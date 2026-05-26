import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CompletedTasksManager } from "@/components/tasks/completed-tasks-manager";
import { isOwnerOrAdminSession } from "@/lib/auth/access";

export default async function CompletedTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canViewAll = isOwnerOrAdminSession(session);
  const companyWhere = canViewAll ? { isActive: true } : { id: { in: session.companyAccess }, isActive: true };

  const [tasks, users, companies] = await Promise.all([
    prisma.completedTask.findMany({
      where: canViewAll ? undefined : { userId: session.id },
      include: {
        user: { select: { id: true, nameAr: true, nameEn: true, email: true } },
        company: { select: { id: true, nameAr: true, nameEn: true } },
        branch: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: [{ taskDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: canViewAll ? { isActive: true } : { id: session.id },
      select: { id: true, nameAr: true, nameEn: true, email: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.company.findMany({
      where: companyWhere,
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        branches: {
          where: canViewAll ? { isActive: true } : { isActive: true, ...(session.branchAccess.length ? { id: { in: session.branchAccess.map((entry) => entry.branchId) } } : {}) },
          select: { id: true, nameAr: true, nameEn: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div>
      <Header title="المهام المنجزة" subtitle="تسجيل مهام الموظفين والمندوبين ومتابعة حالتها وطباعة السجلات." />
      <div className="page-container">
        <CompletedTasksManager
          initialTasks={tasks.map((task) => ({
            ...task,
            taskDate: task.taskDate.toISOString(),
            departedAt: task.departedAt?.toISOString() ?? null,
            returnedAt: task.returnedAt?.toISOString() ?? null,
            deferredToDate: task.deferredToDate?.toISOString() ?? null,
          }))}
          users={users}
          companies={companies}
          currentUserId={session.id}
          canViewAll={canViewAll}
        />
      </div>
    </div>
  );
}
