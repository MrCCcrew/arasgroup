import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SidebarMount } from "@/components/layout/sidebar-mount";
import { SidebarProvider } from "@/components/layout/sidebar-context";

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
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <SidebarMount session={session} userName={session.nameAr ?? session.email} companies={companies} />
        <main className="dashboard-main min-h-screen">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
