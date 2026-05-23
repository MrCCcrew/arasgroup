"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Contract {
  id: string;
  nameAr: string;
  nameEn?: string;
  platform: string;
}

interface Driver {
  id: string;
  walletBalance: string;
  employee: { nameAr: string; nameEn?: string };
}

interface EntryLine {
  driverId: string;
  ordersCount: string;
  rating: string;
  walletAmount: string; // مبلغ التحصيل النقدي اليومي
}

const PLATFORM_LABELS = {
  ar: { TALABAT: "طلبات", RO_POPS: "رو بوبس" },
  en: { TALABAT: "Talabat", RO_POPS: "Ro Pops" },
} as const;

export default function NewDailyOrdersPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [date, setDate] = useState(today);
  const [contractId, setContractId] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/delivery/contracts?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/drivers?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([contractPayload, driverPayload]) => {
      if (contractPayload.success) {
        setContracts(contractPayload.data);
        if (contractPayload.data.length > 0) setContractId(contractPayload.data[0].id);
      }
      if (driverPayload.success) {
        setDrivers(driverPayload.data);
        setLines(
          driverPayload.data.map((d: Driver) => ({
            driverId: d.id,
            ordersCount: "",
            rating: "",
            walletAmount: "",
          }))
        );
      }
    });
  }, [companyId]);

  function updateLine(index: number, field: keyof EntryLine, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const entries = lines
      .filter((line) => line.ordersCount !== "" && Number.parseInt(line.ordersCount, 10) >= 0)
      .map((line) => ({
        driverId: line.driverId,
        ordersCount: Number.parseInt(line.ordersCount, 10),
        ...(line.rating ? { rating: Number.parseFloat(line.rating) } : {}),
        ...(line.walletAmount && Number(line.walletAmount) > 0
          ? { walletAmount: Number(line.walletAmount) }
          : {}),
      }));

    if (entries.length === 0) {
      setError(locale === "en" ? "Enter orders for at least one driver" : "يرجى إدخال عدد الطلبات لسائق واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/delivery/daily-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contractId, date, entries }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "فشل في الحفظ");
      router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  const selectedContract = contracts.find((c) => c.id === contractId);

  const fmtKWD = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-KW" : "en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });

  return (
    <div>
      <Header
        title={locale === "en" ? "New Daily Orders" : "تسجيل طلبات يومية"}
        subtitle={locale === "en" ? "Enter driver daily orders" : "إدخال طلبات السائقين اليومية"}
        companyId={companyId}
      />
      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to daily orders" : "العودة"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* بيانات الجلسة */}
          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Session details" : "بيانات الجلسة"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Date" : "التاريخ"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Contract" : "العقد"} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">{locale === "en" ? "Select contract..." : "اختر العقد..."}</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === "en" ? c.nameEn ?? c.nameAr : c.nameAr}
                      {" — "}
                      {PLATFORM_LABELS[locale][c.platform as keyof typeof PLATFORM_LABELS.ar] ?? c.platform}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* جدول السائقين */}
          <div className="section-card">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Driver orders" : "طلبات السائقين"}
              {selectedContract && (
                <span className="mr-2 font-normal normal-case text-primary">
                  {" — "}
                  {locale === "en" ? selectedContract.nameEn ?? selectedContract.nameAr : selectedContract.nameAr}
                </span>
              )}
            </h3>

            {drivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {locale === "en" ? "No drivers registered" : "لا يوجد سائقون مسجلون"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2 text-right font-medium text-muted-foreground">
                        {locale === "en" ? "Driver" : "السائق"}
                      </th>
                      <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                        {locale === "en" ? "Orders" : "الطلبات"}
                      </th>
                      <th className="w-24 py-2 text-center font-medium text-muted-foreground">
                        {locale === "en" ? "Rating" : "التقييم"}
                      </th>
                      <th className="w-32 py-2 text-center font-medium text-muted-foreground">
                        <div>{locale === "en" ? "Today's cash" : "تحصيل اليوم"}</div>
                        <div className="text-[10px] font-normal text-muted-foreground/70">
                          {locale === "en" ? "(KWD)" : "(د.ك)"}
                        </div>
                      </th>
                      <th className="w-32 py-2 text-center font-medium text-muted-foreground">
                        <div>{locale === "en" ? "Balance" : "رصيد المحفظة"}</div>
                        <div className="text-[10px] font-normal text-muted-foreground/70">
                          {locale === "en" ? "current" : "الحالي"}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lines.map((line, index) => {
                      const driver = drivers.find((d) => d.id === line.driverId);
                      const driverName = driver
                        ? locale === "en"
                          ? driver.employee.nameEn ?? driver.employee.nameAr
                          : driver.employee.nameAr
                        : "-";
                      const balance = driver ? Number(driver.walletBalance) : 0;
                      // الرصيد المتوقع بعد إضافة التحصيل اليومي
                      const walletAmt = line.walletAmount ? Number(line.walletAmount) : 0;
                      const projectedBalance = balance + walletAmt;

                      return (
                        <tr key={line.driverId} className="hover:bg-muted/20">
                          <td className="py-2 pr-2 font-medium">{driverName}</td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={line.ordersCount}
                              onChange={(e) => updateLine(index, "ordersCount", e.target.value)}
                              className="input-field w-full text-center"
                              placeholder="0"
                              dir="ltr"
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min="1"
                              max="5"
                              step="0.1"
                              value={line.rating}
                              onChange={(e) => updateLine(index, "rating", e.target.value)}
                              className="input-field w-full text-center"
                              placeholder="-"
                              dir="ltr"
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={line.walletAmount}
                              onChange={(e) => updateLine(index, "walletAmount", e.target.value)}
                              className="input-field w-full text-center"
                              placeholder="0.000"
                              dir="ltr"
                            />
                          </td>
                          <td className="py-1.5 text-center">
                            <div className={`number text-xs font-bold ${projectedBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                              {fmtKWD(projectedBalance)}
                            </div>
                            {walletAmt > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {locale === "en" ? "after entry" : "بعد التسجيل"}
                              </div>
                            )}
                            {walletAmt === 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {locale === "en" ? "current" : "حالياً"}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="mt-0.5 text-orange-400">●</span>
              <span>
                {locale === "en"
                  ? "Leave orders count empty to skip the driver. Wallet amount = cash collected today by driver (creates a CHARGE transaction)."
                  : "اترك خانة الطلبات فارغة لتجاهل السائق. تحصيل اليوم = النقد اللي جمعه السائق اليوم ويُسجّل كحركة شحن على المحفظة."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !contractId}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading
                ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...")
                : (locale === "en" ? "Save orders" : "حفظ الطلبات")}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
