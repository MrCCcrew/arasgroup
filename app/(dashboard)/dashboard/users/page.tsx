import { redirect } from "next/navigation";
import type { ComponentProps } from "react";
import { Header } from "@/components/layout/header";
import { UserManagement } from "@/components/users/user-management";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession } from "@/lib/auth/access";

type UserManagementProps = ComponentProps<typeof UserManagement>;
type UsersPageData = [
  UserManagementProps["users"],
  UserManagementProps["roles"],
  UserManagementProps["companies"],
  UserManagementProps["permissions"],
];

async function loadUsersPageData(): Promise<UsersPageData> {
  try {
    return await Promise.all([
      prisma.user.findMany({
        include: {
          roles: {
            include: {
              role: { select: { nameAr: true } },
              company: { select: { nameAr: true } },
            },
          },
          companyAccess: {
            include: { company: { select: { nameAr: true } } },
          },
          branchAccess: {
            include: { branch: { select: { nameAr: true } } },
          },
          directPermissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  module: true,
                  action: true,
                  scope: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, nameAr: true },
      }),
      prisma.company.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          type: true,
          branches: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, nameAr: true, companyId: true },
          },
        },
      }),
      prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { action: "asc" }, { scope: "asc" }],
        select: { id: true, module: true, action: true, scope: true },
      }),
    ]);
  } catch (error) {
    console.error("Users page fallback query:", error);

    const [users, roles, companies] = await Promise.all([
      prisma.user.findMany({
        include: {
          roles: {
            include: {
              role: { select: { nameAr: true } },
              company: { select: { nameAr: true } },
            },
          },
          companyAccess: {
            include: { company: { select: { nameAr: true } } },
          },
          branchAccess: {
            include: { branch: { select: { nameAr: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, nameAr: true },
      }),
      prisma.company.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          type: true,
          branches: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, nameAr: true, companyId: true },
          },
        },
      }),
    ]);

    return [
      users.map((user) => ({ ...user, directPermissions: [] as Array<{
        permissionId: string;
        companyId?: string | null;
        branchId?: string | null;
        scopeKey: string;
        isAllowed: boolean;
        permission: {
          id: string;
          module: string;
          action: string;
          scope: string;
        };
      }> })),
      roles,
      companies,
      [] as Array<{ id: string; module: string; action: string; scope: string }>,
    ];
  }
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isOwnerOrAdminSession(session)) redirect("/dashboard");

  const [users, roles, companies, permissions] = await loadUsersPageData();

  return (
    <div>
      <Header
        title="إدارة المستخدمين"
        subtitle="إنشاء المستخدمين، تقييد الوصول، وإدارة كلمات المرور والصلاحيات المباشرة."
      />
      <div className="page-container">
        <UserManagement
          users={users}
          roles={roles}
          companies={companies}
          permissions={permissions}
          canManagePasswords
        />
      </div>
    </div>
  );
}
