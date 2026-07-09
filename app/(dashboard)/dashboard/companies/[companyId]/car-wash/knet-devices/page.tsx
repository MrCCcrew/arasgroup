"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Vehicle {
  id: string;
  code: string;
  nameAr: string;
  knetDeviceId: string | null;
  vehicle: {
    plateNumber: string;
  };
}

export default function KnetDevicesPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deviceIds, setDeviceIds] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/car-wash/vehicles?companyId=${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVehicles(data.data);
          const initialIds: Record<string, string> = {};
          data.data.forEach((v: Vehicle) => {
            initialIds[v.id] = v.knetDeviceId || "";
          });
          setDeviceIds(initialIds);
        }
        setLoading(false);
      });
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const updates = Object.entries(deviceIds).map(([vehicleId, deviceId]) => ({
        vehicleId,
        deviceId: deviceId || null,
      }));

      const response = await fetch("/api/car-wash/knet-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, updates }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      router.push(`/dashboard/companies/${companyId}/car-wash/knet`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">{en ? "Loading..." : "جارٍ التحميل..."}</p>
      </div>
    );
  }

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
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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

        <form onSubmit={handleSubmit} className="space-y-4">

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
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          {en ? "KNET Device ID" : "رقم جهاز KNET"}
                        </label>
                        <input
                          type="text"
                          value={deviceIds[vehicle.id] || ""}
                          onChange={(e) =>
                            setDeviceIds((prev) => ({ ...prev, [vehicle.id]: e.target.value }))
                          }
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
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save size={16} />
                {saving
                  ? en
                    ? "Saving..."
                    : "جارٍ الحفظ..."
                  : en
                    ? "Save Changes"
                    : "حفظ التغييرات"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
