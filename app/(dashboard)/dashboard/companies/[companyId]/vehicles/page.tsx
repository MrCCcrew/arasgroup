import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { daysUntilExpiry } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
}

const VEHICLE_TYPE_LABELS = {
  ar: {
    MOTORCYCLE: "دراجة نارية",
    CAR: "سيارة",
    VAN: "فان",
    TRUCK: "شاحنة",
    OTHER: "أخرى",
  },
  en: {
    MOTORCYCLE: "Motorcycle",
    CAR: "Car",
    VAN: "Van",
    TRUCK: "Truck",
    OTHER: "Other",
  },
} as const;

export default async function VehiclesPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  const vehicles = await prisma.vehicle.findMany({
    where: { companyId, isActive: true },
    include: {
      branch: { select: { nameAr: true, nameEn: true } },
      investor: { select: { nameAr: true, nameEn: true } },
      assignedEmployee: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: { plateNumber: "asc" },
  });

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
            href={`/dashboard/companies/${companyId}/car-wash/vehicles/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "Add vehicle" : "إضافة مركبة"}
          </Link>
        }
      />
      <div className="page-container">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Plate number" : "رقم اللوحة"}</th>
                  <th>{locale === "en" ? "Vehicle number" : "رقم المركبة"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Ownership" : "نمط الملكية"}</th>
                  <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                  <th>{locale === "en" ? "Assigned driver" : "السائق المرتبط"}</th>
                  <th>{locale === "en" ? "Insurance expiry" : "انتهاء التأمين"}</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      {locale === "en" ? "No vehicles found" : "لا توجد مركبات"}
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => {
                    const insuranceDate = vehicle.insuranceExpiryDate ?? vehicle.insuranceExpiry;
                    const days = daysUntilExpiry(insuranceDate);
                    const expiringSoon = days !== null && days <= 30;
                    const branchName = vehicle.branch
                      ? locale === "en"
                        ? vehicle.branch.nameEn ?? vehicle.branch.nameAr
                        : vehicle.branch.nameAr
                      : "—";
                    const driverName = vehicle.assignedEmployee
                      ? locale === "en"
                        ? vehicle.assignedEmployee.nameEn ?? vehicle.assignedEmployee.nameAr
                        : vehicle.assignedEmployee.nameAr
                      : "—";

                    return (
                      <tr key={vehicle.id} className={`transition-colors hover:bg-muted/20 ${expiringSoon ? "bg-yellow-50/30" : ""}`}>
                        <td className="number font-medium">{vehicle.plateNumber}</td>
                        <td className="number">{vehicle.vehicleNumber ?? "—"}</td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {VEHICLE_TYPE_LABELS[locale][vehicle.type as keyof typeof VEHICLE_TYPE_LABELS.ar] ?? vehicle.type}
                          </span>
                        </td>
                        <td className="text-sm">
                          {vehicle.ownershipModel === "RENTED"
                            ? locale === "en" ? "Rented" : "مؤجرة"
                            : locale === "en" ? "Owned" : "مملوكة"}
                        </td>
                        <td className="text-sm">{branchName}</td>
                        <td className="text-sm">{driverName}</td>
                        <td>
                          {insuranceDate ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm">{formatDate(insuranceDate, dateLocale)}</span>
                              {expiringSoon && (
                                <AlertTriangle
                                  size={13}
                                  className={days !== null && days <= 0 ? "text-red-500" : "text-yellow-500"}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
