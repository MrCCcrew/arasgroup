import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function KnetDevicesPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const en = locale === "en";

  const vehicles = await prisma.carWashVehicle.findMany({
    where: { companyId, isActive: true },
    include: {
      vehicle: {
        select: {
          plateNumber: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <Header
        title={en ? "KNET Devices" : "أجهزة KNET"}
        subtitle={en ? "Manage KNET device IDs for each vehicle" : "إدارة أرقام أجهزة KNET لكل سيارة"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/knet`}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            <ArrowLeft size={16} />
            {en ? "Back to KNET" : "العودة لـ KNET"}
          </Link>
        }
      />

      <div className="page-container max-w-4xl">
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 shrink-0 text-blue-600" size={20} />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">{en ? "About KNET Devices" : "حول أجهزة KNET"}</p>
              <p className="mt-1">
                {en
                  ? "Each wash vehicle has its own KNET device. Enter the device ID/number for each vehicle to track transactions by device."
                  : "كل سيارة غسيل لها جهاز KNET خاص. أدخل رقم/معرف الجهاز لكل سيارة لتتبع المعاملات حسب الجهاز."}
              </p>
            </div>
          </div>
        </div>

        <form action="/api/car-wash/knet-devices" method="POST" className="space-y-4">
          <input type="hidden" name="companyId" value={companyId} />

          <div className="rounded-xl border bg-card">
            <div className="border-b bg-muted/30 px-6 py-4">
              <h2 className="font-semibold">{en ? "Vehicle KNET Devices" : "أجهزة KNET للسيارات"}</h2>
            </div>

            <div className="divide-y">
              {vehicles.length === 0 ? (
                <div className="px-6 py-12 text-center text-muted-foreground">
                  {en ? "No vehicles found" : "لا توجد سيارات"}
                </div>
              ) : (
                vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="px-6 py-4">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                            {vehicle.code}
                          </span>
                          <div>
                            <p className="font-medium">{vehicle.nameAr}</p>
                            <p className="text-sm text-muted-foreground">
                              {vehicle.vehicle.plateNumber}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="w-80">
                        <input type="hidden" name={`${vehicle.id}_id`} value={vehicle.id} />
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          {en ? "KNET Device ID" : "رقم جهاز KNET"}
                        </label>
                        <input
                          type="text"
                          name={`${vehicle.id}_deviceId`}
                          defaultValue={vehicle.knetDeviceId ?? ""}
                          placeholder={en ? "Enter device ID..." : "أدخل رقم الجهاز..."}
                          className="input-field w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {vehicles.length > 0 && (
            <div className="flex justify-end gap-3">
              <Link
                href={`/dashboard/companies/${companyId}/car-wash/knet`}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                {en ? "Cancel" : "إلغاء"}
              </Link>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Save size={16} />
                {en ? "Save Changes" : "حفظ التغييرات"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
