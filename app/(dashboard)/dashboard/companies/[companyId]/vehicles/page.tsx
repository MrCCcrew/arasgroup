import Link from "next/link";
import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { VehiclesClient } from "./VehiclesClient";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function VehiclesPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();

  const [vehicles, branches, licenses] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId, isActive: true, type: { not: "CAR_WASH" } },
      include: {
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
        assignedEmployee: { select: { nameAr: true, nameEn: true } },
        license: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
      },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.license.findMany({
      where: { companyId, status: { notIn: ["CANCELLED", "INACTIVE"] } },
      select: { id: true, commercialNameAr: true, licenseNumber: true },
      orderBy: { commercialNameAr: "asc" },
    }),
  ]);

  return (
    <div>
      <Header
        title={locale === "en" ? "Vehicles" : "المركبات"}
        subtitle={
          locale === "en"
            ? `${vehicles.length} active vehicle(s)`
            : `${vehicles.length} مركبة نشطة`
        }
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/vehicles/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "Add vehicle" : "إضافة مركبة"}
          </Link>
        }
      />
      <VehiclesClient
        initialVehicles={vehicles as VehicleRow[]}
        branches={branches}
        licenses={licenses}
        companyId={companyId}
        locale={locale}
      />
    </div>
  );
}

// types exported for client
export type VehicleRow = {
  id: string;
  plateNumber: string;
  vehicleNumber: string | null;
  type: string;
  ownershipModel: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  chassisNumber: string | null;
  trackingDeviceId: string | null;
  fuelCardNumber: string | null;
  insuranceExpiry: Date | null;
  insuranceExpiryDate: Date | null;
  registrationExpiry: Date | null;
  municipalityCardNumber: string | null;
  municipalityCardExpiryDate: Date | null;
  advertisingCardNumber: string | null;
  advertisingCardExpiryDate: Date | null;
  notes: string | null;
  licenseId: string | null;
  branch: { nameAr: string; nameEn: string | null } | null;
  investor: { nameAr: string; nameEn: string | null } | null;
  assignedEmployee: { nameAr: string; nameEn: string | null } | null;
  license: { id: string; commercialNameAr: string; licenseNumber: string } | null;
};
