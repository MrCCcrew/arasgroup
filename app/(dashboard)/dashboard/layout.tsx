import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SidebarMount } from "@/components/layout/sidebar-mount";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(session.isSuperAdmin ? {} : { id: { in: session.companyAccess } }),
    },
    select: { id: true, nameAr: true, nameEn: true, type: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarMount session={session} userName={session.nameAr ?? session.email} companies={companies} />
      <main className="dashboard-main flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}
