import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { OwnerManagementBreadcrumb } from "@/components/owner-management/breadcrumb";

export default async function OwnerManagementLayout({ children, params }: { children: React.ReactNode; params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "OWNER_MANAGED", isActive: true }, select: { nameAr: true, nameEn: true } });
  if (!company) notFound();
  return <><OwnerManagementBreadcrumb companyId={companyId} companyNameAr={company.nameAr} companyNameEn={company.nameEn} />{children}</>;
}
