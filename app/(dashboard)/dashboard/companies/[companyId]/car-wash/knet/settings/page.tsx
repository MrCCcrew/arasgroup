"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Setting {
  id: string;
  cardType: string;
  percentageRate: number;
  fixedAmount: number;
}

const CARD_TYPES = [
  { value: "KNET", labelAr: "كي نت محلي", labelEn: "KNET Local" },
  { value: "VISA_LOCAL", labelAr: "فيزا محلي", labelEn: "Visa Local" },
  { value: "VISA_INTL", labelAr: "فيزا دولي", labelEn: "Visa International" },
  { value: "MASTERCARD_LOCAL", labelAr: "ماستركارد محلي", labelEn: "Mastercard Local" },
  { value: "MASTERCARD_INTL", labelAr: "ماستركارد دولي", labelEn: "Mastercard International" },
] as const;

export default function KnetCommissionSettingsPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";

  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Record<string, { percentage: string; fixed: string }>>({});

  useEffect(() => {
    fetch(`/api/car-wash/knet/commission-settings?companyId=${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSettings(data.data);
          const initialData: Record<string, { percentage: string; fixed: string }> = {};
          data.data.forEach((s: Setting) => {
            initialData[s.cardType] = {
              percentage: Number(s.percentageRate).toFixed(3),
              fixed: Number(s.fixedAmount).toFixed(3),
            };
          });
          setFormData(initialData);
        }
        setLoading(false);
      });
  }, [companyId]);

  const settingsMap = new Map(settings.map((s) => [s.cardType, s]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = CARD_TYPES.map((cardType) => {
        const setting = settingsMap.get(cardType.value);
        const data = formData[cardType.value] || { percentage: "0", fixed: "0" };
        return {
          id: setting?.id,
          cardType: cardType.value,
          percentageRate: Number.parseFloat(data.percentage) || 0,
          fixedAmount: Number.parseFloat(data.fixed) || 0,
        };
      });

      const response = await fetch("/api/car-wash/knet/commission-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, settings: payload }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to save");

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
        title={en ? "KNET Commission Settings" : "إعدادات عمولة KNET"}
        subtitle={en ? "Configure commission rates for different card types" : "تكوين نسب العمولة لأنواع الكروت المختلفة"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/knet`}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            <ArrowLeft size={16} />
            {en ? "Back to Settlements" : "العودة للتسويات"}
          </Link>
        }
      />

      <div className="page-container">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border bg-card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold">{en ? "Commission Calculation" : "حساب العمولة"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {en
                ? "Commission = (Amount × Percentage %) + Fixed Amount"
                : "العمولة = (المبلغ × النسبة %) + المبلغ الثابت"}
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="space-y-4">
              {CARD_TYPES.map((cardType) => {
                const setting = settingsMap.get(cardType.value);
                return (
                  <div key={cardType.value} className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">{en ? cardType.labelEn : cardType.labelAr}</h3>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {cardType.value}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          {en ? "Percentage (%)" : "النسبة المئوية (%)"}
                        </label>
                        <input
                          type="number"
                          value={formData[cardType.value]?.percentage || "0"}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [cardType.value]: {
                                ...prev[cardType.value],
                                percentage: e.target.value,
                              },
                            }))
                          }
                          step="0.001"
                          min="0"
                          max="100"
                          className="input-field"
                          placeholder={en ? "e.g., 1.750" : "مثال: 1.750"}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {en ? "Enter as decimal (e.g., 1.750 for 1.75%)" : "أدخل كرقم عشري (مثال: 1.750 يعني 1.75%)"}
                        </p>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          {en ? "Fixed Amount (KWD)" : "المبلغ الثابت (د.ك)"}
                        </label>
                        <input
                          type="number"
                          value={formData[cardType.value]?.fixed || "0"}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [cardType.value]: {
                                ...prev[cardType.value],
                                fixed: e.target.value,
                              },
                            }))
                          }
                          step="0.001"
                          min="0"
                          className="input-field"
                          placeholder={en ? "e.g., 0.100" : "مثال: 0.100"}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {en ? "Fixed fee per transaction" : "رسم ثابت لكل معاملة"}
                        </p>
                      </div>
                    </div>

                    {/* Example calculation */}
                    <div className="mt-3 rounded border border-primary/20 bg-primary/5 p-3 text-xs">
                      <p className="font-medium text-primary">
                        {en ? "Example:" : "مثال:"}{" "}
                        {en ? "For a 10 KWD transaction" : "لمعاملة بقيمة 10 د.ك"}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {en ? "Commission" : "العمولة"} ={" "}
                        (10 × {setting ? Number(setting.percentageRate).toFixed(3) : "0"}%) + {setting ? Number(setting.fixedAmount).toFixed(3) : "0"}{" "}
                        = <span className="font-semibold text-foreground">
                          {(
                            (10 * Number(setting?.percentageRate ?? 0)) / 100 +
                            Number(setting?.fixedAmount ?? 0)
                          ).toFixed(3)}{" "}
                          {en ? "KWD" : "د.ك"}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
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
                {saving ? (en ? "Saving..." : "جارٍ الحفظ...") : en ? "Save Settings" : "حفظ الإعدادات"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
