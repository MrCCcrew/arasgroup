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
  ratePerOrder: string;
  grossAmount: string;
  walletDeducted: string;
  rating: string;
  walletAmount: string;
}

interface DailyEntry {
  date: string;
  ordersCount: string;
  ratePerOrder: string;
  grossAmount: string;
  walletDeducted: string;
  rating: string;
  walletAmount: string;
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
  const [contractId, setContractId] = useState("");

  // Single date mode (legacy - all drivers for one day)
  const [dateMode, setDateMode] = useState<"single" | "multiple">("single");
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<EntryLine[]>([]);

  // Multiple dates mode (one driver for multiple days)
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);

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
            ratePerOrder: "",
            grossAmount: "",
            walletDeducted: "",
            rating: "",
            walletAmount: "",
          }))
        );
        // Set first driver as selected for multiple mode
        if (driverPayload.data.length > 0) {
          setSelectedDriverId(driverPayload.data[0].id);
        }
      }
    });
  }, [companyId]);

  // Sync daily entries when dates change in multiple mode
  useEffect(() => {
    if (dateMode === "multiple") {
      syncDailyEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, fromDate, toDate, additionalDates]);

  function updateLine(index: number, field: keyof EntryLine, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  // Generate list of dates based on mode
  function getSelectedDates(): string[] {
    if (dateMode === "single") {
      return [date];
    }

    const dates: string[] = [];

    // Add dates from range
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const current = new Date(start);

      while (current <= end) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    }

    // Add additional specific dates (excluding duplicates)
    additionalDates.forEach((d) => {
      if (!dates.includes(d)) {
        dates.push(d);
      }
    });

    return dates.sort();
  }

  function toggleAdditionalDate(dateStr: string) {
    setAdditionalDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  }

  // Update daily entries when selected dates change (multiple mode only)
  function syncDailyEntries() {
    if (dateMode !== "multiple") return;

    const selectedDates = getSelectedDates();
    setDailyEntries((prev) => {
      const newEntries: DailyEntry[] = selectedDates.map((date) => {
        const existing = prev.find((e) => e.date === date);
        return existing ?? { date, ordersCount: "", ratePerOrder: "", grossAmount: "", walletDeducted: "", rating: "", walletAmount: "" };
      });
      return newEntries;
    });
  }

  // Update a specific day's data
  function updateDailyEntry(date: string, field: keyof Omit<DailyEntry, "date">, value: string) {
    setDailyEntries((prev) =>
      prev.map((entry) => (entry.date === date ? { ...entry, [field]: value } : entry))
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (dateMode === "single") {
      // Legacy mode: all drivers for one day
      const entries = lines
        .filter((line) => line.ordersCount !== "" && Number.parseInt(line.ordersCount, 10) >= 0)
        .map((line) => ({
          driverId: line.driverId,
          ordersCount: Number.parseInt(line.ordersCount, 10),
          ...(line.ratePerOrder ? { ratePerOrder: Number(line.ratePerOrder) } : {}),
          ...(line.grossAmount ? { grossAmount: Number(line.grossAmount) } : {}),
          ...(line.walletDeducted ? { walletDeducted: Number(line.walletDeducted) } : {}),
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
          body: JSON.stringify({
            companyId,
            contractId,
            dates: [date],
            entries,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "فشل في الحفظ");
        router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل في الحفظ");
      } finally {
        setLoading(false);
      }
    } else {
      // Multiple mode: one driver for multiple days
      if (!selectedDriverId) {
        setError(locale === "en" ? "Please select a driver" : "يرجى اختيار سائق");
        return;
      }

      const validEntries = dailyEntries.filter(
        (entry) => entry.ordersCount !== "" && Number.parseInt(entry.ordersCount, 10) >= 0
      );

      if (validEntries.length === 0) {
        setError(locale === "en" ? "Enter orders for at least one day" : "يرجى إدخال عدد الطلبات ليوم واحد على الأقل");
        return;
      }

      setLoading(true);
      try {
        // Send each day separately with the same driver
        const requests = validEntries.map((entry) => ({
          companyId,
          contractId,
          dates: [entry.date],
          entries: [
            {
              driverId: selectedDriverId,
              ordersCount: Number.parseInt(entry.ordersCount, 10),
              ...(entry.ratePerOrder ? { ratePerOrder: Number(entry.ratePerOrder) } : {}),
              ...(entry.grossAmount ? { grossAmount: Number(entry.grossAmount) } : {}),
              ...(entry.walletDeducted ? { walletDeducted: Number(entry.walletDeducted) } : {}),
              ...(entry.rating ? { rating: Number.parseFloat(entry.rating) } : {}),
              ...(entry.walletAmount && Number(entry.walletAmount) > 0
                ? { walletAmount: Number(entry.walletAmount) }
                : {}),
            },
          ],
        }));

        const results = await Promise.all(
          requests.map((req) =>
            fetch("/api/delivery/daily-orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(req),
            })
          )
        );

        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          throw new Error(`فشل في حفظ ${failed.length} من ${results.length} يوم`);
        }

        router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل في الحفظ");
      } finally {
        setLoading(false);
      }
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

            {/* Contract */}
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

            {/* Date Mode Toggle */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                {locale === "en" ? "Date mode" : "وضع التاريخ"} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "single"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Single day" : "يوم واحد"}
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("multiple")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "multiple"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Multiple days" : "عدة أيام"}
                </button>
              </div>
            </div>

            {/* Single Date */}
            {dateMode === "single" && (
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
            )}

            {/* Multiple Dates */}
            {dateMode === "multiple" && (
              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {locale === "en" ? "Date range (continuous)" : "نطاق التواريخ (متصل)"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        {locale === "en" ? "From" : "من"}
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="input-field w-full"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        {locale === "en" ? "To" : "إلى"}
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        min={fromDate}
                        className="input-field w-full"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Specific Dates */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {locale === "en" ? "Additional specific dates" : "تواريخ محددة إضافية"}
                  </label>
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 text-xs text-muted-foreground">
                      {locale === "en"
                        ? "Click to add/remove specific dates outside the range"
                        : "انقر لإضافة/إزالة تواريخ محددة خارج النطاق"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((offset) => {
                        const d = new Date();
                        d.setDate(d.getDate() + offset);
                        const dateStr = d.toISOString().split("T")[0];
                        const isSelected = additionalDates.includes(dateStr);
                        const dayName = d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { weekday: "short" });
                        const dayNum = d.getDate();

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => toggleAdditionalDate(dateStr)}
                            className={`flex flex-col items-center rounded-lg border px-3 py-2 text-xs transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <span className="font-medium">{dayName}</span>
                            <span className="text-lg font-bold">{dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Dates Summary */}
                {getSelectedDates().length > 0 && (
                  <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                    <div className="mb-1 text-xs font-medium text-blue-900 dark:text-blue-100">
                      {locale === "en" ? "Selected dates" : "التواريخ المختارة"} ({getSelectedDates().length})
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-blue-700 dark:text-blue-300">
                      {getSelectedDates().map((d) => (
                        <span key={d} className="rounded bg-blue-100 px-2 py-0.5 dark:bg-blue-900/40">
                          {new Date(d + "T12:00:00").toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Single Day Mode: All Drivers Table */}
          {dateMode === "single" && (
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
                        <th className="w-20 py-2 text-center font-medium text-muted-foreground">
                          {locale === "en" ? "Orders" : "الطلبات"}
                        </th>
                        <th className="w-24 py-2 text-center font-medium text-muted-foreground">
                          <div>{locale === "en" ? "Rate" : "السعر"}</div>
                          <div className="text-[10px] font-normal text-muted-foreground/70">
                            {locale === "en" ? "(KWD)" : "(د.ك)"}
                          </div>
                        </th>
                        <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                          <div>{locale === "en" ? "Gross" : "الإجمالي"}</div>
                          <div className="text-[10px] font-normal text-muted-foreground/70">
                            {locale === "en" ? "(KWD)" : "(د.ك)"}
                          </div>
                        </th>
                        <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                          <div>{locale === "en" ? "Wallet" : "المحفظة"}</div>
                          <div className="text-[10px] font-normal text-muted-foreground/70">
                            {locale === "en" ? "(KWD)" : "(د.ك)"}
                          </div>
                        </th>
                        <th className="w-20 py-2 text-center font-medium text-muted-foreground">
                          {locale === "en" ? "Rating" : "التقييم"}
                        </th>
                        <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                          <div>{locale === "en" ? "Cash" : "تحصيل"}</div>
                          <div className="text-[10px] font-normal text-muted-foreground/70">
                            {locale === "en" ? "(KWD)" : "(د.ك)"}
                          </div>
                        </th>
                        <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                          <div>{locale === "en" ? "Balance" : "الرصيد"}</div>
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
                        const walletAmt = line.walletAmount ? Number(line.walletAmount) : 0;
                        const projectedBalance = balance + walletAmt;

                        // Auto-calculate gross from orders × rate
                        const orders = line.ordersCount ? Number(line.ordersCount) : 0;
                        const rate = line.ratePerOrder ? Number(line.ratePerOrder) : 0;
                        const autoGross = orders * rate;

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
                                min="0"
                                step="0.001"
                                value={line.ratePerOrder}
                                onChange={(e) => updateLine(index, "ratePerOrder", e.target.value)}
                                className="input-field w-full text-center"
                                placeholder="0.000"
                                dir="ltr"
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={line.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")}
                                onChange={(e) => updateLine(index, "grossAmount", e.target.value)}
                                className="input-field w-full text-center"
                                placeholder="0.000"
                                dir="ltr"
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={line.walletDeducted}
                                onChange={(e) => updateLine(index, "walletDeducted", e.target.value)}
                                className="input-field w-full text-center"
                                placeholder="0.000"
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Multiple Days Mode: Select Driver + Daily Entries */}
          {dateMode === "multiple" && (
            <>
              {/* Select Driver */}
              <div className="section-card">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {locale === "en" ? "Select driver" : "اختر السائق"}
                </h3>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  <option value="">{locale === "en" ? "Choose driver..." : "اختر السائق..."}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {locale === "en" ? d.employee.nameEn ?? d.employee.nameAr : d.employee.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Daily Entries Table */}
              {dailyEntries.length > 0 && selectedDriverId && (
                <div className="section-card">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {locale === "en" ? "Daily orders" : "الطلبات اليومية"}
                    <span className="mr-2 font-normal normal-case text-primary">
                      {" — "}
                      {drivers.find((d) => d.id === selectedDriverId)?.employee.nameAr}
                    </span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-2 text-right font-medium text-muted-foreground">
                            {locale === "en" ? "Date" : "التاريخ"}
                          </th>
                          <th className="w-20 py-2 text-center font-medium text-muted-foreground">
                            {locale === "en" ? "Orders" : "الطلبات"}
                          </th>
                          <th className="w-24 py-2 text-center font-medium text-muted-foreground">
                            <div>{locale === "en" ? "Rate" : "السعر"}</div>
                            <div className="text-[10px] font-normal text-muted-foreground/70">
                              {locale === "en" ? "(KWD)" : "(د.ك)"}
                            </div>
                          </th>
                          <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                            <div>{locale === "en" ? "Gross" : "الإجمالي"}</div>
                            <div className="text-[10px] font-normal text-muted-foreground/70">
                              {locale === "en" ? "(KWD)" : "(د.ك)"}
                            </div>
                          </th>
                          <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                            <div>{locale === "en" ? "Wallet" : "المحفظة"}</div>
                            <div className="text-[10px] font-normal text-muted-foreground/70">
                              {locale === "en" ? "(KWD)" : "(د.ك)"}
                            </div>
                          </th>
                          <th className="w-20 py-2 text-center font-medium text-muted-foreground">
                            {locale === "en" ? "Rating" : "التقييم"}
                          </th>
                          <th className="w-28 py-2 text-center font-medium text-muted-foreground">
                            <div>{locale === "en" ? "Cash" : "تحصيل"}</div>
                            <div className="text-[10px] font-normal text-muted-foreground/70">
                              {locale === "en" ? "(KWD)" : "(د.ك)"}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {dailyEntries.map((entry) => {
                          const dateObj = new Date(entry.date + "T12:00:00");
                          const dayName = dateObj.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                            weekday: "short",
                          });
                          const dateFormatted = dateObj.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                            month: "short",
                            day: "numeric",
                          });

                          // Auto-calculate gross
                          const orders = entry.ordersCount ? Number(entry.ordersCount) : 0;
                          const rate = entry.ratePerOrder ? Number(entry.ratePerOrder) : 0;
                          const autoGross = orders * rate;

                          return (
                            <tr key={entry.date} className="hover:bg-muted/20">
                              <td className="py-2 pr-2">
                                <div className="font-medium">{dateFormatted}</div>
                                <div className="text-xs text-muted-foreground">{dayName}</div>
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={entry.ordersCount}
                                  onChange={(e) => updateDailyEntry(entry.date, "ordersCount", e.target.value)}
                                  className="input-field w-full text-center"
                                  placeholder="0"
                                  dir="ltr"
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={entry.ratePerOrder}
                                  onChange={(e) => updateDailyEntry(entry.date, "ratePerOrder", e.target.value)}
                                  className="input-field w-full text-center"
                                  placeholder="0.000"
                                  dir="ltr"
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={entry.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")}
                                  onChange={(e) => updateDailyEntry(entry.date, "grossAmount", e.target.value)}
                                  className="input-field w-full text-center"
                                  placeholder="0.000"
                                  dir="ltr"
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={entry.walletDeducted}
                                  onChange={(e) => updateDailyEntry(entry.date, "walletDeducted", e.target.value)}
                                  className="input-field w-full text-center"
                                  placeholder="0.000"
                                  dir="ltr"
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="5"
                                  step="0.1"
                                  value={entry.rating}
                                  onChange={(e) => updateDailyEntry(entry.date, "rating", e.target.value)}
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
                                  value={entry.walletAmount}
                                  onChange={(e) => updateDailyEntry(entry.date, "walletAmount", e.target.value)}
                                  className="input-field w-full text-center"
                                  placeholder="0.000"
                                  dir="ltr"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-blue-400">ℹ</span>
                    <span>
                      {locale === "en"
                        ? "Enter different data for each day. Leave orders empty to skip that day."
                        : "أدخل بيانات مختلفة لكل يوم. اترك الطلبات فارغة لتجاهل ذلك اليوم."}
                    </span>
                  </div>
                </div>
              )}

              {dailyEntries.length === 0 && (
                <div className="section-card">
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {locale === "en" ? "Select dates above to continue" : "اختر التواريخ أعلاه للمتابعة"}
                  </p>
                </div>
              )}
            </>
          )}

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
