"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { LocationOrderEntry } from "@/components/delivery/location-order-entry";

interface Contract {
  id: string;
  nameAr: string;
  nameEn?: string;
  platform: string;
  usesLocationPricing?: boolean;
}

interface Driver {
  id: string;
  walletBalance: string;
  employee: { nameAr: string; nameEn?: string; isActive: boolean };
}

type WorkStatus = "WORKED" | "ON_LEAVE" | "VEHICLE_BREAKDOWN" | "NO_SHIFTS" | "MISSED_SHIFT" | "LATE_LOGIN" | "ABSENT";

interface EntryLine {
  driverId: string;
  ordersCount: string;
  ratePerOrder: string;
  grossAmount: string;
  walletDeducted: string;
  tips: string;
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
  tips: string;
  walletAmount: string;
  operatedAsDriverId: string;
  workStatus: WorkStatus;
}

const AR = {
  talabat: "\u0637\u0644\u0628\u0627\u062a",
  worked: "\u0639\u0645\u0644",
  onLeave: "\u0625\u062c\u0627\u0632\u0629",
  vehicleBreakdown: "\u0639\u0637\u0644 \u0633\u064a\u0627\u0631\u0629",
  noShifts: "\u0628\u062f\u0648\u0646 \u0634\u064a\u0641\u062a\u0627\u062a",
  missedShift: "\u0639\u0646\u062f\u0647 \u0634\u064a\u0641\u062a \u0648\u0644\u0645 \u064a\u0639\u0645\u0644",
  lateLogin: "\u062a\u0623\u062e\u0631 \u0641\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
  absent: "\u063a\u064a\u0627\u0628",
  inactive: "(\u063a\u064a\u0631 \u0646\u0634\u0637)",
  enterOneLine: "\u0623\u062f\u062e\u0644 \u0633\u0637\u0631\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644",
  saveFailed: "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u062d\u0641\u0638",
  chooseDriver: "\u064a\u0631\u062c\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u0633\u0627\u0626\u0642",
  enterOneDay: "\u0623\u062f\u062e\u0644 \u064a\u0648\u0645\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644",
  pageTitle: "\u062a\u0633\u062c\u064a\u0644 \u0637\u0644\u0628\u0627\u062a \u064a\u0648\u0645\u064a\u0629",
  pageSubtitle: "\u0625\u062f\u062e\u0627\u0644 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646 \u0627\u0644\u064a\u0648\u0645\u064a\u0629",
  back: "\u0627\u0644\u0639\u0648\u062f\u0629",
  sessionDetails: "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062c\u0644\u0633\u0629",
  contract: "\u0627\u0644\u0639\u0642\u062f",
  selectContract: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0639\u0642\u062f...",
  dateMode: "\u0648\u0636\u0639 \u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  singleDay: "\u064a\u0648\u0645 \u0648\u0627\u062d\u062f",
  multipleDays: "\u0639\u062f\u0629 \u0623\u064a\u0627\u0645",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  from: "\u0645\u0646",
  to: "\u0625\u0644\u0649",
  additionalDates: "\u062a\u0648\u0627\u0631\u064a\u062e \u0625\u0636\u0627\u0641\u064a\u0629",
  driverOrders: "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0633\u0627\u0626\u0642\u064a\u0646",
  driver: "\u0627\u0644\u0633\u0627\u0626\u0642",
  status: "\u0627\u0644\u062d\u0627\u0644\u0629",
  workedUnder: "\u0639\u0645\u0644 \u0628\u0627\u0633\u0645",
  orders: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  rate: "\u0627\u0644\u0633\u0639\u0631",
  gross: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
  wallet: "\u0627\u0644\u0645\u062d\u0641\u0638\u0629",
  tips: "\u0625\u0643\u0631\u0627\u0645\u064a\u0627\u062a",
  cash: "\u062a\u062d\u0635\u064a\u0644",
  ownName: "\u0628\u0627\u0633\u0645\u0647",
  worksUnderLabel: "\u064a\u0639\u0645\u0644 \u0628\u0627\u0633\u0645:",
  selectDriver: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0627\u0626\u0642",
  chooseDriverOption: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0627\u0626\u0642...",
  dailyEntries: "\u0627\u0644\u062a\u0633\u062c\u064a\u0644\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629",
  saving: "\u062c\u0627\u0631\u064d \u0627\u0644\u062d\u0641\u0638...",
  saveOrders: "\u062d\u0641\u0638 \u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  cancel: "\u0625\u0644\u063a\u0627\u0621",
} as const;

const PLATFORM_LABELS = {
  ar: { TALABAT: AR.talabat, RO_POPS: "Ro Pops" },
  en: { TALABAT: "Talabat", RO_POPS: "Ro Pops" },
} as const;

const WORK_STATUS_LABELS = {
  ar: {
    WORKED: AR.worked,
    ON_LEAVE: AR.onLeave,
    VEHICLE_BREAKDOWN: AR.vehicleBreakdown,
    NO_SHIFTS: AR.noShifts,
    MISSED_SHIFT: AR.missedShift,
    LATE_LOGIN: AR.lateLogin,
    ABSENT: AR.absent,
  },
  en: {
    WORKED: "Worked",
    ON_LEAVE: "On leave",
    VEHICLE_BREAKDOWN: "Vehicle breakdown",
    NO_SHIFTS: "No shifts",
    MISSED_SHIFT: "Missed shift",
    LATE_LOGIN: "Late login",
    ABSENT: "Absent",
  },
} as const;

function emptyLine(driverId = ""): EntryLine {
  return {
    driverId,
    ordersCount: "",
    ratePerOrder: "",
    grossAmount: "",
    walletDeducted: "",
    tips: "",
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
    tips: "",
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

  const aliasDriverOptions = useMemo(
    () =>
      drivers.map((driver) => ({
        id: driver.id,
        name: getDriverName(driver),
      })),
    [drivers, locale],
  );

  function getDriverName(driver: Driver) {
    const base = locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr;
    return driver.employee.isActive ? base : `${base} ${locale === "en" ? "(Inactive)" : AR.inactive}`;
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
    setDailyEntries((prev) =>
      dates.map((currentDate) => prev.find((entry) => entry.date === currentDate) ?? emptyDailyEntry(currentDate)),
    );
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
      entry.tips !== "" ||
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
          ...(line.tips ? { tips: Number(line.tips) } : {}),
          ...(line.walletAmount ? { walletAmount: Number(line.walletAmount) } : {}),
        }));

      if (entries.length === 0) {
        setError(locale === "en" ? "Enter at least one line" : AR.enterOneLine);
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
        if (!res.ok) throw new Error(payload.error ?? AR.saveFailed);
        router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
      } catch (err) {
        setError(err instanceof Error ? err.message : AR.saveFailed);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedDriverId) {
      setError(locale === "en" ? "Please select a driver" : AR.chooseDriver);
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
        ...(entry.tips ? { tips: Number(entry.tips) } : {}),
        ...(entry.walletAmount ? { walletAmount: Number(entry.walletAmount) } : {}),
      }));

    if (entries.length === 0) {
      setError(locale === "en" ? "Enter at least one day" : AR.enterOneDay);
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
      if (!res.ok && res.status !== 207) throw new Error(payload.error ?? AR.saveFailed);
      router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
    } catch (err) {
      setError(err instanceof Error ? err.message : AR.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  const selectedContract = contracts.find((contract) => contract.id === contractId);
  const isLocationPricing = !!selectedContract?.usesLocationPricing;

  return (
    <div>
      <Header
        title={locale === "en" ? "New Daily Orders" : AR.pageTitle}
        subtitle={locale === "en" ? "Enter driver daily orders" : AR.pageSubtitle}
        companyId={companyId}
      />

      <div className="page-container max-w-6xl">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to daily orders" : AR.back}
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Session details" : AR.sessionDetails}
            </h3>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Contract" : AR.contract} <span className="text-red-500">*</span>
              </label>
              <select required value={contractId} onChange={(event) => setContractId(event.target.value)} className="input-field w-full">
                <option value="">{locale === "en" ? "Select contract..." : AR.selectContract}</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {locale === "en" ? contract.nameEn ?? contract.nameAr : contract.nameAr}
                    {" - "}
                    {PLATFORM_LABELS[locale][contract.platform as keyof typeof PLATFORM_LABELS.ar] ?? contract.platform}
                  </option>
                ))}
              </select>
            </div>

            {!isLocationPricing && (
            <div>
              <label className="mb-2 block text-sm font-medium">{locale === "en" ? "Date mode" : AR.dateMode}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDateMode("single")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "single" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Single day" : AR.singleDay}
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("multiple")}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    dateMode === "multiple" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  }`}
                >
                  {locale === "en" ? "Multiple days" : AR.multipleDays}
                </button>
              </div>
            </div>
            )}

            {(isLocationPricing || dateMode === "single") ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Date" : AR.date}</label>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "From" : AR.from}</label>
                    <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "To" : AR.to}</label>
                    <input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">{locale === "en" ? "Additional dates" : AR.additionalDates}</label>
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

          {isLocationPricing && (
            <LocationOrderEntry companyId={companyId} contractId={contractId} date={date} drivers={aliasDriverOptions} />
          )}

          {!isLocationPricing && (dateMode === "single" ? (
            <div className="section-card">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {locale === "en" ? "Driver orders" : AR.driverOrders}
                {selectedContract && (
                  <span className="mr-2 font-normal normal-case text-primary">
                    {" - "}
                    {locale === "en" ? selectedContract.nameEn ?? selectedContract.nameAr : selectedContract.nameAr}
                  </span>
                )}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-2 text-right font-medium text-muted-foreground">{locale === "en" ? "Driver" : AR.driver}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Status" : AR.status}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Worked under" : AR.workedUnder}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Orders" : AR.orders}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rate" : AR.rate}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Gross" : AR.gross}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Wallet" : AR.wallet}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Tips" : AR.tips}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Cash" : AR.cash}</th>
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
                          <td className="px-2 py-1.5 text-center">
                            <select value={line.workStatus} onChange={(event) => updateLine(index, "workStatus", event.target.value)} className="input-field w-32 text-center">
                              {(Object.keys(WORK_STATUS_LABELS.ar) as WorkStatus[]).map((status) => (
                                <option key={status} value={status}>
                                  {WORK_STATUS_LABELS[locale][status]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <select value={line.operatedAsDriverId} onChange={(event) => updateLine(index, "operatedAsDriverId", event.target.value)} className="input-field w-32 text-center">
                              <option value="">{locale === "en" ? "Own name" : AR.ownName}</option>
                              {aliasDriverOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                            {line.operatedAsDriverId && (
                              <div className="mt-1 text-xs text-amber-700">
                                {locale === "en" ? "Works under:" : AR.worksUnderLabel}{" "}
                                {aliasDriverOptions.find((option) => option.id === line.operatedAsDriverId)?.name}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" value={line.ordersCount} onChange={(event) => updateLine(index, "ordersCount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={line.ratePerOrder} onChange={(event) => updateLine(index, "ratePerOrder", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={line.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")} onChange={(event) => updateLine(index, "grossAmount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={line.walletDeducted} onChange={(event) => updateLine(index, "walletDeducted", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={line.tips} onChange={(event) => updateLine(index, "tips", event.target.value)} className="input-field w-16 text-center" dir="ltr" /></td>
                          <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={line.walletAmount} onChange={(event) => updateLine(index, "walletAmount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
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
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Select driver" : AR.selectDriver}</h3>
                <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="input-field w-full">
                  <option value="">{locale === "en" ? "Choose driver..." : AR.chooseDriverOption}</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {getDriverName(driver)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDriverId && (
                <div className="section-card">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Daily entries" : AR.dailyEntries}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2 pr-2 text-right font-medium text-muted-foreground">{locale === "en" ? "Date" : AR.date}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Status" : AR.status}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Worked under" : AR.workedUnder}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Orders" : AR.orders}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Rate" : AR.rate}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Gross" : AR.gross}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Wallet" : AR.wallet}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Tips" : AR.tips}</th>
                          <th className="px-2 py-2 text-center font-medium text-muted-foreground">{locale === "en" ? "Cash" : AR.cash}</th>
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
                              <td className="px-2 py-1.5 text-center">
                                <select value={entry.workStatus} onChange={(event) => updateDailyEntry(entry.date, "workStatus", event.target.value)} className="input-field w-32 text-center">
                                  {(Object.keys(WORK_STATUS_LABELS.ar) as WorkStatus[]).map((status) => (
                                    <option key={status} value={status}>
                                      {WORK_STATUS_LABELS[locale][status]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <select value={entry.operatedAsDriverId} onChange={(event) => updateDailyEntry(entry.date, "operatedAsDriverId", event.target.value)} className="input-field w-32 text-center">
                                  <option value="">{locale === "en" ? "Own name" : AR.ownName}</option>
                                  {aliasDriverOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.name}
                                    </option>
                                  ))}
                                </select>
                                {entry.operatedAsDriverId && (
                                  <div className="mt-1 text-xs text-amber-700">
                                    {locale === "en" ? "Works under:" : AR.worksUnderLabel}{" "}
                                    {aliasDriverOptions.find((option) => option.id === entry.operatedAsDriverId)?.name}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" value={entry.ordersCount} onChange={(event) => updateDailyEntry(entry.date, "ordersCount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={entry.ratePerOrder} onChange={(event) => updateDailyEntry(entry.date, "ratePerOrder", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={entry.grossAmount || (autoGross > 0 ? autoGross.toFixed(3) : "")} onChange={(event) => updateDailyEntry(entry.date, "grossAmount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={entry.walletDeducted} onChange={(event) => updateDailyEntry(entry.date, "walletDeducted", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={entry.tips} onChange={(event) => updateDailyEntry(entry.date, "tips", event.target.value)} className="input-field w-16 text-center" dir="ltr" /></td>
                              <td className="px-2 py-1.5 text-center"><input type="number" min="0" step="0.001" value={entry.walletAmount} onChange={(event) => updateDailyEntry(entry.date, "walletAmount", event.target.value)} className="input-field w-24 text-center" dir="ltr" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ))}

          {!isLocationPricing && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !contractId}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : AR.saving) : locale === "en" ? "Save orders" : AR.saveOrders}
            </button>
            <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted">
              {locale === "en" ? "Cancel" : AR.cancel}
            </Link>
          </div>
          )}
        </form>
      </div>
    </div>
  );
}
