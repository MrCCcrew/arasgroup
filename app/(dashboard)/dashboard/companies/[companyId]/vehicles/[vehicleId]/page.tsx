import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Car } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { VehicleAttachments } from "./VehicleAttachments";

interface Props {
  params: Promise<{ companyId: string; vehicleId: string }>;
}

const DOC_LABELS: Record<string, string> = {
  REGISTRATION_BOOK: "دفتر التسجيل",
  LICENSE: "رخصة السيارة",
  INSURANCE: "التأمين",
  FOOD_LICENSE: "ترخيص الأغذية",
  ADVERTISING_LICENSE: "ترخيص الإعلان",
  MUNICIPALITY_CARD: "بطاقة البلدية",
  OTHER: "أخرى",
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DateField({ label, value }: { label: string; value?: Date | null }) {
  if (!value) return null;
  const date = new Date(value);
  const days = Math.floor((date.getTime() - Date.now()) / 86400000);
  const color = days < 0 ? "text-red-600" : days <= 30 ? "text-red-500" : days <= 90 ? "text-orange-500" : "text-foreground";
  const badge = days < 0 ? "منتهية" : days <= 30 ? `${days} يوم` : days <= 90 ? `${days} يوم` : null;
  return (
    <div className="flex justify-between py-2 border-b border-border/50 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${color}`}>{date.toLocaleDateString("ar-KW")}</span>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${days < 0 ? "bg-red-100 text-red-700" : days <= 30 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function VehicleDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, vehicleId } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId, companyId },
    include: {
      branch: { select: { nameAr: true } },
      investor: { select: { nameAr: true } },
      assignedEmployee: { select: { nameAr: true } },
    },
  });

  if (!vehicle) redirect(`/dashboard/companies/${companyId}/vehicles`);

  const attachments = await prisma.attachment.findMany({
    where: { refModule: "VEHICLE", refId: vehicleId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Header
        title={vehicle.plateNumber}
        subtitle={[vehicle.make, vehicle.model, vehicle.year?.toString()].filter(Boolean).join(" ") || "مركبة توصيل"}
        companyId={companyId}
      />

      <div className="page-container space-y-6">
        {/* Back */}
        <Link
          href={`/dashboard/companies/${companyId}/vehicles`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowRight size={14} />
          العودة للمركبات
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* بيانات المركبة */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-4">
              <Car size={18} className="text-primary" />
              <h2 className="font-bold">بيانات المركبة</h2>
            </div>
            <Field label="رقم اللوحة" value={vehicle.plateNumber} />
            <Field label="رقم المركبة" value={vehicle.vehicleNumber} />
            <Field label="الماركة" value={vehicle.make} />
            <Field label="الموديل" value={vehicle.model} />
            <Field label="سنة الصنع" value={vehicle.year} />
            <Field label="اللون" value={vehicle.color} />
            <Field label="رقم الهيكل" value={vehicle.chassisNumber} />
            <Field
              label="نمط الملكية"
              value={vehicle.ownershipModel === "RENTED" ? "مؤجرة" : "مملوكة"}
            />
            <Field label="الفرع" value={vehicle.branch?.nameAr} />
            <Field label="المستثمر" value={vehicle.investor?.nameAr} />
            <Field label="السائق" value={vehicle.assignedEmployee?.nameAr} />
            <Field label="رقم جهاز التتبع" value={vehicle.trackingDeviceId} />
            <Field label="رقم بطاقة الوقود" value={vehicle.fuelCardNumber} />
          </div>

          {/* تواريخ الانتهاء */}
          <div className="section-card">
            <h2 className="font-bold mb-4">تواريخ الانتهاء</h2>
            <DateField label="التأمين" value={vehicle.insuranceExpiry ?? vehicle.insuranceExpiryDate} />
            <DateField label="التسجيل" value={vehicle.registrationExpiry} />
            <DateField label="بطاقة البلدية" value={vehicle.municipalityCardExpiryDate} />
            <DateField label="بطاقة الدعاية" value={vehicle.advertisingCardExpiryDate} />
            <DateField label="رخصة الأغذية" value={vehicle.foodLicenseExpiryDate} />

            {vehicle.municipalityCardNumber && (
              <Field label="رقم بطاقة البلدية" value={vehicle.municipalityCardNumber} />
            )}
            {vehicle.advertisingCardNumber && (
              <Field label="رقم بطاقة الدعاية" value={vehicle.advertisingCardNumber} />
            )}
            {vehicle.foodLicenseNumber && (
              <Field label="رقم رخصة الأغذية" value={vehicle.foodLicenseNumber} />
            )}
            {vehicle.notes && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm">{vehicle.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* المرفقات */}
        <VehicleAttachments
          vehicleId={vehicleId}
          companyId={companyId}
          initialAttachments={attachments}
          docLabels={DOC_LABELS}
        />
      </div>
    </div>
  );
}
