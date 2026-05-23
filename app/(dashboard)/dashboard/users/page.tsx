import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { UserManagement } from "@/components/users/user-management";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isSuperAdmin) redirect("/dashboard");

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

  return (
    <div>
      <Header title="إدارة المستخدمين" subtitle="إنشاء المستخدمين وتقييد الوصول بالشركة والفروع" />
      <div className="page-container">
        <UserManagement users={users} roles={roles} companies={companies} />
      </div>
    </div>
  );
}
