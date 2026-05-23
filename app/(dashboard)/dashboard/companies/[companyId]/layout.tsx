import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";

interface Props {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function CompanyLayout({ children, params }: Props) {
  const { companyId } = await params;
  const session = await getSession();

  if (!session) redirect("/login");

  if (!session.isSuperAdmin && !session.companyAccess.includes(companyId)) {
    redirect("/dashboard");
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, isActive: true },
    select: { id: true },
  });

  if (!company) notFound();

  return <>{children}</>;
}
