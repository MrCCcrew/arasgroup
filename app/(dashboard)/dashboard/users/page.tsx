import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { UserManagement } from "@/components/users/user-management";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession } from "@/lib/auth/access";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isOwnerOrAdminSession(session)) redirect("/dashboard");

  const [users, roles, companies, permissions] = await Promise.all([
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

  return (
    <div>
      <Header
        title={"إدارة المستخدمين"}
        subtitle={"إنشاء المستخدمين، تقييد الوصول، وإدارة كلمات المرور والصلاحيات المباشرة."}
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
