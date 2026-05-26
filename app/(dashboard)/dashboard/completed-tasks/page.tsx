import { redirect } from "next/navigation";
import type { ComponentProps } from "react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CompletedTasksManager } from "@/components/tasks/completed-tasks-manager";
import { isOwnerOrAdminSession } from "@/lib/auth/access";

type CompletedTasksManagerProps = ComponentProps<typeof CompletedTasksManager>;
type CompletedTasksPageData = [
  CompletedTasksManagerProps["initialTasks"],
  CompletedTasksManagerProps["users"],
  CompletedTasksManagerProps["companies"],
];

async function loadCompletedTasksPageData(
  currentUserId: string,
  canViewAll: boolean,
  companyAccess: string[],
  branchIds: string[],
): Promise<CompletedTasksPageData> {
  const companyWhere = canViewAll ? { isActive: true } : { id: { in: companyAccess }, isActive: true };

  try {
    const [tasks, users, companies] = await Promise.all([
      prisma.completedTask.findMany({
        where: canViewAll ? undefined : { userId: currentUserId },
        include: {
          user: { select: { id: true, nameAr: true, nameEn: true, email: true } },
          company: { select: { id: true, nameAr: true, nameEn: true } },
          branch: { select: { id: true, nameAr: true, nameEn: true } },
        },
        orderBy: [{ taskDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.user.findMany({
        where: canViewAll ? { isActive: true } : { id: currentUserId },
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
            where: canViewAll
              ? { isActive: true }
              : {
                  isActive: true,
                  ...(branchIds.length ? { id: { in: branchIds } } : {}),
                },
            select: { id: true, nameAr: true, nameEn: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return [
      tasks.map((task) => ({
        ...task,
        taskDate: task.taskDate.toISOString(),
        departedAt: task.departedAt?.toISOString() ?? null,
        returnedAt: task.returnedAt?.toISOString() ?? null,
        deferredToDate: task.deferredToDate?.toISOString() ?? null,
      })),
      users,
      companies,
    ];
  } catch (error) {
    console.error("Completed tasks page fallback query:", error);

    const [users, companies] = await Promise.all([
      prisma.user.findMany({
        where: canViewAll ? { isActive: true } : { id: currentUserId },
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
            where: canViewAll
              ? { isActive: true }
              : {
                  isActive: true,
                  ...(branchIds.length ? { id: { in: branchIds } } : {}),
                },
            select: { id: true, nameAr: true, nameEn: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return [[], users, companies];
  }
}

export default async function CompletedTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canViewAll = isOwnerOrAdminSession(session);
  const [tasks, users, companies] = await loadCompletedTasksPageData(
    session.id,
    canViewAll,
    session.companyAccess,
    session.branchAccess.map((entry) => entry.branchId),
  );

  return (
    <div>
      <Header
        title="المهام المنجزة"
        subtitle="تسجيل مهام الموظفين والمندوبين ومتابعة حالتها وطباعة السجلات."
      />
      <div className="page-container">
        <CompletedTasksManager
          initialTasks={tasks}
          users={users}
          companies={companies}
          currentUserId={session.id}
          canViewAll={canViewAll}
        />
      </div>
    </div>
  );
}
