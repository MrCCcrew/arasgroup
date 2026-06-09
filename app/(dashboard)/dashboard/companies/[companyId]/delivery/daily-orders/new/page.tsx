"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  employee: { nameAr: string; nameEn?: string; isActive: boolean };
}

type WorkStatus = "WORKED" | "ON_LEAVE" | "VEHICLE_BREAKDOWN" | "NO_SHIFTS" | "MISSED_SHIFT" | "LATE_LOGIN";

interface EntryLine {
  driverId: string;
  ordersCount: string;
  ratePerOrder: string;
  grossAmount: string;
  walletDeducted: string;
  rating: string;
  walletAmount: string;
  operatedAsDriverId: string;
  workStatus: WorkStatus;
}

interface DailyEntry {
  date: string;
  ordersCount: string;
  ratePerOrder: string;
  grossAmount: string;
  walletDeducted: string;
  rating: string;
  walletAmount: string;
  operatedAsDriverId: string;
  workStatus: WorkStatus;
}

const PLATFORM_LABELS = {
  ar: { TALABAT: "طلبات", RO_POPS: "Ro Pops" },
  en: { TALABAT: "Talabat", RO_POPS: "Ro Pops" },
} as const;

const WORK_STATUS_LABELS = {
  ar: {
    WORKED: "عمل",
    ON_LEAVE: "إجازة",
    VEHICLE_BREAKDOWN: "عطل سيارة",
    NO_SHIFTS: "بدون شيفتات",
    MISSED_SHIFT: "عنده شيفت ولم يعمل",
    LATE_LOGIN: "تأخر في تسجيل الدخول",
  },
  en: {
    WORKED: "Worked",
    ON_LEAVE: "On leave",
    VEHICLE_BREAKDOWN: "Vehicle breakdown",
    NO_SHIFTS: "No shifts",
    MISSED_SHIFT: "Missed shift",
    LATE_LOGIN: "Late login",
  },
} as const;

function emptyLine(driverId = ""): EntryLine {
  return {
    driverId,
    ordersCount: "",
    ratePerOrder: "",
    grossAmount: "",
    walletDeducted: "",
    rating: "",
    walletAmount: "",
    operatedAsDriverId: "",
    workStatus: "WORKED",
  };
}

function emptyDailyEntry(date: string): DailyEntry {
  return {
    date,
    ordersCount: "",
    ratePerOrder: "",
    grossAmount: "",
    walletDeducted: "",
    rating: "",
    walletAmount: "",
    operatedAsDriverId: "",
    workStatus: "WORKED",
  };
}

export default function NewDailyOrdersPage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const today = new Date().toISOString().slice(0, 10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [contractId, setContractId] = useState("");
  const [dateMode, setDateMode] = useState<"single" | "multiple">("single");
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<EntryLine[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/delivery/contracts?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/delivery/drivers?companyId=${companyId}&includeInactive=true`).then((r) => r.json()),
    ]).then(([contractPayload, driverPayload]) => {
      if (contractPayload.success) {
        setContracts(contractPayload.data);
        if (contractPayload.data.length > 0) setContractId(contractPayload.data[0].id);
      }
      if (driverPayload.success) {
        const allDrivers = driverPayload.data as Driver[];
        setDrivers(allDrivers);
        setLines(allDrivers.map((driver) => emptyLine(driver.id)));
        const firstActive = allDrivers.find((driver) => driver.employee.isActive) ?? allDrivers[0];
        if (firstActive) setSelectedDriverId(firstActive.id);
      }
    });
  }, [companyId]);

  const inactiveDriverOptions = useMemo(
    () =>
      drivers
        .filter((driver) => !driver.employee.isActive)
        .map((driver) => ({
          id: driver.id,
          name: locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr,
        })),
    [drivers, locale],
  );

  function getDriverName(driver: Driver) {
    const base = locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr;
    return driver.employee.isActive ? base : `${base} ${locale === "en" ? "(Inactive)" : "(غير نشط)"}`;
  }

  function getSelectedDates() {
    if (dateMode === "single") return [date];
    const dates: string[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    for (const extra of additionalDates) {
      if (!dates.includes(extra)) dates.push(extra);
    }
    return dates.sort();
  }

  useEffect(() => {
    if (dateMode !== "multiple") return;
    const dates = getSelectedDates();
    setDailyEntries((prev) => dates.map((currentDate) => prev.find((entry) => entry.date === currentDate) ?? emptyDailyEntry(currentDate)));
  }, [dateMode, fromDate, toDate, additionalDates]);

  function toggleAdditionalDate(dateStr: string) {
    setAdditionalDates((prev) => (prev.includes(dateStr) ? prev.filter((value) => value !== dateStr) : [...prev, dateStr]));
  }

  function updateLine(index: number, field: keyof EntryLine, value: string) {
    setLines((prev) => prev.map((line, currentIndex) => (currentIndex === index ? { ...line, [field]: value } : line)));
  }

  function updateDailyEntry(dateKey: string, field: keyof Omit<DailyEntry, "date">, value: string) {
    setDailyEntries((prev) => prev.map((entry) => (entry.date === dateKey ? { ...entry, [field]: value } : entry)));
  }

  function hasMeaningfulData(entry: EntryLine | DailyEntry) {
    return (
      entry.ordersCount !== "" ||
      entry.ratePerOrder !== "" ||
      entry.grossAmount !== "" ||
      entry.walletDeducted !== "" ||
      entry.rating !== "" ||
      entry.walletAmount !== "" ||
      entry.operatedAsDriverId !== "" ||
      entry.workStatus !== "WORKED"
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (dateMode === "single") {
      const entries = lines
        .filter(hasMeaningfulData)
        .map((line) => ({
          driverId: line.driverId,
          ordersCount: line.ordersCount === "" ? 0 : Number.parseInt(line.ordersCount, 10),
          workStatus: line.workStatus,
          operatedAsDriverId: line.operatedAsDriverId || null,
          ...(line.ratePerOrder ? { ratePerOrder: Number(line.ratePerOrder) } : {}),
          ...(line.grossAmount ? { grossAmount: Number(line.grossAmount) } : {}),
          ...(line.walletDeducted ? { walletDeducted: Number(line.walletDeducted) } : {}),
          ...(line.rating ? { rating: Number(line.rating) } : {}),
          ...(line.walletAmount ? { walletAmount: Number(line.walletAmount) } : {}),
        }));

      if (entries.length === 0) {
        setError(locale === "en" ? "Enter at least one line" : "أدخل سطرًا واحدًا على الأقل");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/delivery/daily-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, contractId, dates: [date], entries }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "فشل في الحفظ");
        router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل في الحفظ");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedDriverId) {
      setError(locale === "en" ? "Please select a driver" : "يرجى اختيار سائق");
      return;
    }

    const entries = dailyEntries
      .filter(hasMeaningfulData)
      .map((entry) => ({
        date: entry.date,
        driverId: selectedDriverId,
        ordersCount: entry.ordersCount === "" ? 0 : Number.parseInt(entry.ordersCount, 10),
        workStatus: entry.workStatus,
        operatedAsDriverId: entry.operatedAsDriverId || null,
        ...(entry.ratePerOrder ? { ratePerOrder: Number(entry.ratePerOrder) } : {}),
        ...(entry.grossAmount ? { grossAmount: Number(entry.grossAmount) } : {}),
        ...(entry.walletDeducted ? { walletDeducted: Number(entry.walletDeducted) } : {}),
        ...(entry.rating ? { rating: Number(entry.rating) } : {}),
        ...(entry.walletAmount ? { walletAmount: Number(entry.walletAmount) } : {}),
      }));

    if (entries.length === 0) {
      setError(locale === "en" ? "Enter at least one day" : "أدخل يومًا واحدًا على الأقل");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/delivery/daily-orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contractId, entries }),
      });
      const payload = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(payload.error ?? "فشل في الحفظ");
      router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  const selectedContract = contracts.find((contract) => contract.id === contractId);

  return (
    <div>
      <Header
        title={locale === "en" ? "New Daily Orders" : "تسجيل طلبات يومية"}
        subtitle={locale === "en" ? "Enter driver daily orders" : "إدخال طلبات السائقين اليومية"}
        companyId={companyId}
      />

      <div className="page-container max-w-6xl">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to daily orders" : "العودة"}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Session details" : "بيانات الجلسة"}
            </h3>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Contract" : "العقد"} <span className="text-red-500">*</span>
              </label>
              <select required value={contractId} onChange={(event) => setContractId(event.target.value)} className="input-field w-full">
                <option value="">{locale === "en" ? "Select contract..." : "اختر العقد..."}</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {locale === "en" ? contract.nameEn ?? contract.nameAr : contract.nameAr}
                    {" - "}
                    {PLATFORM_LABELS[locale][contract.platform as keyof typeof PLATFORM_LABELS.ar] ?? contract.platform}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "en" ? "Date mode" : "وضع التاريخ"}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "single" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Single day" : "يوم واحد"}
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("multiple")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "multiple" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Multiple days" : "عدة أيام"}
                </button>
              </div>
            </div>

            {dateMode === "single" ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Date" : "التاريخ"}</label>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "From" : "من"}</label>
                    <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "To" : "إلى"}</label>
                    <input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">{locale === "en" ? "Additional dates" : "تواريخ إضافية"}</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, offset) => {
                      const value = new Date();
                      value.setDate(value.getDate() + offset);
                      const dateStr = value.toISOString().slice(0, 10);
                      const active = additionalDates.includes(dateStr);
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => toggleAdditionalDate(dateStr)}
                          className={`rounded-lg border px-3 py-2 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                        >
                          {value.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {dateMode === "single" ? (
            <div className="section-card">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Driver orders" : "طلبات السائقين"}
                {selectedContract && <span className="mr-2 font-normal normal-case text-primary"> - {locale === "en" ? selectedContract.nameEn ?? selectedContract.nameAr : selectedContract.nameAr}</span>}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2 text-right font-medium text-muted-foreground">{locale === "en" ? "Driver" : "السائق"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Status" : "الحالة"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Worked under" : "عمل باسم"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Orders" : "الطلبات"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rate" : "السعر"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Gross" : "الإجمالي"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Wallet" : "المحفظة"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rating" : "التقييم"}</th>
                      <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Cash" : "تحصيل"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lines.map((line, index) => {
                      const driver = drivers.find((item) => item.id === line.driverId);
                      if (!driver) return null;
                      const orders = line.ordersCount ? Number(line.ordersCount) : 0;
                      const rate = line.ratePerOrder ? Number(line.ratePerOrder) : 0;
                      const autoGross = orders * rate;

                      return (
                        <tr key={line.driverId} className="hover:bg-muted/20">
                          <td className="py-2 pr-2 font-medium">{getDriverName(driver)}</td>
                          <td className="py-1.5">
                            <select value={line.workStatus} onChange={(event) => updateLine(index, "workStatus", event.target.value)} className="input-field w-44 text-center">
                              {(Object.keys(WORK_STATUS_LABELS.ar) as WorkStatus[]).map((status) => (
                                <option key={status} value={status}>{WORK_STATUS_LABELS[locale][status]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5">
                            <select value={line.operatedAsDriverId} onChange={(event) => updateLine(index, "operatedAsDriverId", event.target.value)} className="input-field w-44 text-center">
                              <option value="">{locale === "en" ? "Own name" : "باسمه"}</option>
                              {inactiveDriverOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5"><input type="number" min="0" value={line.ordersCount} onChange={(event) => updateLine(index, "ordersCount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" min="0" step="0.001" value={line.ratePerOrder} onChange={(event) => updateLine(index, "ratePerOrder", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" min="0" step="0.001" value={line.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")} onChange={(event) => updateLine(index, "grossAmount", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" min="0" step="0.001" value={line.walletDeducted} onChange={(event) => updateLine(index, "walletDeducted", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" min="1" max="5" step="0.1" value={line.rating} onChange={(event) => updateLine(index, "rating", event.target.value)} className="input-field w-20 text-center" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" min="0" step="0.001" value={line.walletAmount} onChange={(event) => updateLine(index, "walletAmount", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="section-card">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Select driver" : "اختر السائق"}</h3>
                <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="input-field w-full">
                  <option value="">{locale === "en" ? "Choose driver..." : "اختر السائق..."}</option>
                  {drivers.filter((driver) => driver.employee.isActive).map((driver) => (
                    <option key={driver.id} value={driver.id}>{getDriverName(driver)}</option>
                  ))}
                </select>
              </div>

              {selectedDriverId && (
                <div className="section-card">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Daily entries" : "التسجيلات اليومية"}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-2 text-right font-medium text-muted-foreground">{locale === "en" ? "Date" : "التاريخ"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Status" : "الحالة"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Worked under" : "عمل باسم"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Orders" : "الطلبات"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rate" : "السعر"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Gross" : "الإجمالي"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Wallet" : "المحفظة"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rating" : "التقييم"}</th>
                          <th className="py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Cash" : "تحصيل"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {dailyEntries.map((entry) => {
                          const orders = entry.ordersCount ? Number(entry.ordersCount) : 0;
                          const rate = entry.ratePerOrder ? Number(entry.ratePerOrder) : 0;
                          const autoGross = orders * rate;
                          return (
                            <tr key={entry.date} className="hover:bg-muted/20">
                              <td className="py-2 pr-2 font-medium">{new Date(`${entry.date}T12:00:00`).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}</td>
                              <td className="py-1.5">
                                <select value={entry.workStatus} onChange={(event) => updateDailyEntry(entry.date, "workStatus", event.target.value)} className="input-field w-44 text-center">
                                  {(Object.keys(WORK_STATUS_LABELS.ar) as WorkStatus[]).map((status) => (
                                    <option key={status} value={status}>{WORK_STATUS_LABELS[locale][status]}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5">
                                <select value={entry.operatedAsDriverId} onChange={(event) => updateDailyEntry(entry.date, "operatedAsDriverId", event.target.value)} className="input-field w-44 text-center">
                                  <option value="">{locale === "en" ? "Own name" : "باسمه"}</option>
                                  {inactiveDriverOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{option.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5"><input type="number" min="0" value={entry.ordersCount} onChange={(event) => updateDailyEntry(entry.date, "ordersCount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                              <td className="py-1.5"><input type="number" min="0" step="0.001" value={entry.ratePerOrder} onChange={(event) => updateDailyEntry(entry.date, "ratePerOrder", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                              <td className="py-1.5"><input type="number" min="0" step="0.001" value={entry.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")} onChange={(event) => updateDailyEntry(entry.date, "grossAmount", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                              <td className="py-1.5"><input type="number" min="0" step="0.001" value={entry.walletDeducted} onChange={(event) => updateDailyEntry(entry.date, "walletDeducted", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                              <td className="py-1.5"><input type="number" min="1" max="5" step="0.1" value={entry.rating} onChange={(event) => updateDailyEntry(entry.date, "rating", event.target.value)} className="input-field w-20 text-center" dir="ltr" /></td>
                              <td className="py-1.5"><input type="number" min="0" step="0.001" value={entry.walletAmount} onChange={(event) => updateDailyEntry(entry.date, "walletAmount", event.target.value)} className="input-field w-28 text-center" dir="ltr" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Save orders" : "حفظ الطلبات"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
