"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Save, Trash2, Truck, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

const INCENTIVE_RATE = 0.5;
const DEFAULT_FOOD_ALLOWANCE = "15";
const DELIVERY_DRIVER_TYPES = ["DRIVER", "DELIVERY_DRIVER"];

const arText = {
  driver: "\u0633\u0627\u0626\u0642",
  deliveryDriver: "\u0633\u0627\u0626\u0642 \u062a\u0648\u0635\u064a\u0644",
  deliveryAdmin: "\u0625\u062f\u0627\u0631\u064a \u062a\u0648\u0635\u064a\u0644",
  carWashDriver: "\u0633\u0627\u0626\u0642 \u063a\u0633\u064a\u0644",
  carWashWorker: "\u0639\u0627\u0645\u0644 \u063a\u0633\u064a\u0644",
  officeEmployee: "\u0645\u0648\u0638\u0641 \u0645\u0643\u062a\u0628",
  accountant: "\u0645\u062d\u0627\u0633\u0628",
  mandoub: "\u0645\u0646\u062f\u0648\u0628",
  officeBoy: "\u0639\u0627\u0645\u0644 \u062e\u062f\u0645\u0627\u062a",
  other: "\u0623\u062e\u0631\u0649",
  loadBatchFailed: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062f\u0641\u0639\u0629",
  loadDataFailed: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
  atLeastOne: "\u064a\u062c\u0628 \u0625\u062f\u062e\u0627\u0644 \u0631\u0627\u062a\u0628 \u0644\u0645\u0648\u0638\u0641 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644",
  saveFailed: "\u0641\u0634\u0644 \u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a",
  unexpected: "\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639",
  loading: "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...",
  title: "\u062a\u0639\u062f\u064a\u0644 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628",
  subtitle: "\u062a\u0639\u062f\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0642\u0628\u0644 \u0627\u0644\u062a\u0631\u062d\u064a\u0644",
  backToBatch: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u062f\u0641\u0639\u0629",
  cannotEdit: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0647\u0630\u0647 \u0627\u0644\u062f\u0641\u0639\u0629 \u0628\u0639\u062f \u0627\u0644\u062a\u0631\u062d\u064a\u0644 \u0623\u0648 \u0628\u0639\u062f \u062a\u063a\u064a\u064a\u0631 \u062d\u0627\u0644\u062a\u0647\u0627 \u0627\u0644\u0646\u0647\u0627\u0626\u064a\u0629.",
  batchInfo: "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062f\u0641\u0639\u0629",
  month: "\u0627\u0644\u0634\u0647\u0631",
  year: "\u0627\u0644\u0633\u0646\u0629",
  notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  optionalNotes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629",
  deliveryDrivers: "\u0633\u0627\u0626\u0642\u0648 \u0627\u0644\u062a\u0648\u0635\u064a\u0644",
  target: "\u062a\u0627\u0631\u062c\u064a\u062a",
  orders: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a",
  incentive: "\u062d\u0627\u0641\u0632",
  food: "\u0628\u062f\u0644 \u0637\u0639\u0627\u0645",
  companyAdd: "\u0625\u0636\u0627\u0641\u0629 \u0634\u0631\u0643\u0629",
  fuel: "\u0628\u0646\u0632\u064a\u0646 \u0648\u0628\u0646\u0634\u0631",
  targetDeduction: "\u062e\u0635\u0645 \u062a\u0627\u0631\u062c\u064a\u062a",
  companyDeduction: "\u062e\u0635\u0645 \u0634\u0631\u0643\u0629",
  net: "\u0627\u0644\u0635\u0627\u0641\u064a",
  otherEmployees: "\u0645\u0648\u0638\u0641\u0648\u0646 \u0622\u062e\u0631\u0648\u0646",
  employee: "\u0627\u0644\u0645\u0648\u0638\u0641",
  type: "\u0627\u0644\u0646\u0648\u0639",
  baseSalary: "\u0627\u0644\u0631\u0627\u062a\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064a",
  incentives: "\u0627\u0644\u062d\u0648\u0627\u0641\u0632",
  additions: "\u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062a",
  deductions: "\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a",
  saving: "\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...",
  saveChanges: "\u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a",
  cancel: "\u0625\u0644\u063a\u0627\u0621",
  totalNet: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0635\u0627\u0641\u064a:",
  kwd: "\u062f.\u0643",
  removeFromBatch: "\u062d\u0630\u0641 \u0645\u0646 \u0627\u0644\u062f\u0641\u0639\u0629",
  restoreToBatch: "\u0625\u0639\u0627\u062f\u0629 \u0644\u0644\u062f\u0641\u0639\u0629",
  removedEmployees: "\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0629 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u062f\u0641\u0639\u0629",
  removeHint: "\u0627\u0644\u062d\u0630\u0641 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u062f\u0641\u0639\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0641\u0642\u0637.",
};

interface DriverInfo {
  id: string;
  targetOrders: number;
}

interface Employee {
  id: string;
  nameAr: string;
  type: string;
  baseSalary: number | null;
  actualSalary: number | null;
  driver: DriverInfo | null;
}

interface BatchEmployee {
  id: string;
  nameAr: string;
  type: string;
  baseSalary?: number | null;
}

interface BatchPayment {
  employeeId: string;
  baseAmount: string | number;
  incentives: string | number;
  additionalEarnings: string | number;
  deductions: string | number;
  attendanceDays?: string | number | null;
  evaluationScore?: string | number | null;
  targetOrders?: number | null;
  actualOrders?: number | null;
  walletAmount?: string | number | null;
  amountDeliveredByDriver?: string | number | null;
  notes?: string | null;
  employee: BatchEmployee;
}

interface SalaryItem {
  employeeId: string | null;
  type: string;
  amount: string | number;
}

interface BatchResponse {
  id: string;
  month: number;
  year: number;
  status: string;
  notes?: string | null;
  journalEntry?: { status: string; isDeleted: boolean } | null;
  payments: BatchPayment[];
  items: SalaryItem[];
}

interface PaymentLine {
  employeeId: string;
  included: boolean;
  isDriver: boolean;
  driverId: string | null;
  baseAmount: string;
  targetOrders: string;
  actualOrders: string;
  incentive: string;
  foodAllowance: string;
  companyAddition: string;
  fuelAddition: string;
  targetDeduction: string;
  companyDeduction: string;
  additionalEarnings: string;
  deductions: string;
  notes: string;
  attendanceDays: string;
  evaluationScore: string;
  walletAmount: string;
  amountDeliveredByDriver: string;
}

const employeeTypeLabels: Record<string, { ar: string; en: string }> = {
  DRIVER: { ar: arText.driver, en: "Driver" },
  DELIVERY_DRIVER: { ar: arText.deliveryDriver, en: "Delivery Driver" },
  DELIVERY_ADMIN: { ar: arText.deliveryAdmin, en: "Delivery Admin" },
  CAR_WASH_DRIVER: { ar: arText.carWashDriver, en: "Car Wash Driver" },
  CAR_WASH_WORKER: { ar: arText.carWashWorker, en: "Car Wash Worker" },
  OFFICE_EMPLOYEE: { ar: arText.officeEmployee, en: "Office Employee" },
  ACCOUNTANT: { ar: arText.accountant, en: "Accountant" },
  MANDOUB: { ar: arText.mandoub, en: "Mandoub" },
  OFFICE_BOY: { ar: arText.officeBoy, en: "Office Boy" },
  OTHER: { ar: arText.other, en: "Other" },
};

function n(value: string) {
  return parseFloat(value) || 0;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function itemAmount(items: SalaryItem[], employeeId: string, type: string) {
  const item = items.find((entry) => entry.employeeId === employeeId && entry.type === type);
  return item ? Number(item.amount) : 0;
}

export default function EditSalaryBatchPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string; batchId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;
  const batchId = params.batchId;
  const ar = locale !== "en";

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [employeesRes, batchRes] = await Promise.all([
          fetch(`/api/hr/employees?companyId=${companyId}&active=true`),
          fetch(`/api/hr/salaries/${batchId}`),
        ]);

        const [employeesPayload, batchPayload] = await Promise.all([employeesRes.json(), batchRes.json()]);
        if (!mounted) return;

        if (!batchPayload.success) {
          throw new Error(batchPayload.error ?? (ar ? arText.loadBatchFailed : "Failed to load batch"));
        }

        const loadedBatch: BatchResponse = batchPayload.data;
        const activeEmployees: Employee[] = employeesPayload.success ? employeesPayload.data : [];
        const existingEmployees = loadedBatch.payments.map((payment) => payment.employee);
        const mergedEmployees = [
          ...activeEmployees,
          ...existingEmployees
            .filter((employee) => !activeEmployees.some((active) => active.id === employee.id))
            .map((employee) => ({
              id: employee.id,
              nameAr: employee.nameAr,
              type: employee.type,
              baseSalary: employee.baseSalary ?? null,
              actualSalary: employee.baseSalary ?? null,
              driver: null,
            })),
        ];

        setBatch(loadedBatch);
        setMonth(loadedBatch.month);
        setYear(loadedBatch.year);
        setNotes(loadedBatch.notes ?? "");
        setEmployees(mergedEmployees);
        setLines(
          mergedEmployees.map((employee) => {
            const payment = loadedBatch.payments.find((entry) => entry.employeeId === employee.id);
            const isDriver = DELIVERY_DRIVER_TYPES.includes(employee.type);

            if (!payment) {
              return {
                employeeId: employee.id,
                included: true,
                isDriver,
                driverId: employee.driver?.id ?? null,
                baseAmount: (employee.actualSalary ?? employee.baseSalary) != null ? String(employee.actualSalary ?? employee.baseSalary) : "",
                targetOrders: isDriver ? String(employee.driver?.targetOrders ?? 370) : "",
                actualOrders: "",
                incentive: "0",
                foodAllowance: isDriver ? DEFAULT_FOOD_ALLOWANCE : "0",
                companyAddition: "0",
                fuelAddition: "0",
                targetDeduction: "0",
                companyDeduction: "0",
                additionalEarnings: "0",
                deductions: "0",
                notes: "",
                attendanceDays: "",
                evaluationScore: "",
                walletAmount: "",
                amountDeliveredByDriver: "",
              };
            }

            return {
              employeeId: employee.id,
              included: true,
              isDriver,
              driverId: employee.driver?.id ?? null,
              baseAmount: String(payment.baseAmount ?? ""),
              targetOrders: payment.targetOrders != null ? String(payment.targetOrders) : String(employee.driver?.targetOrders ?? 370),
              actualOrders: payment.actualOrders != null ? String(payment.actualOrders) : "",
              incentive: String(itemAmount(loadedBatch.items, employee.id, "INCENTIVE") || Number(payment.incentives ?? 0)),
              foodAllowance: String(itemAmount(loadedBatch.items, employee.id, "FOOD_ALLOWANCE")),
              companyAddition: String(itemAmount(loadedBatch.items, employee.id, "COMPANY_ADDITION")),
              fuelAddition: String(itemAmount(loadedBatch.items, employee.id, "FUEL_ADDITION")),
              targetDeduction: String(itemAmount(loadedBatch.items, employee.id, "TARGET_DEDUCTION")),
              companyDeduction: String(itemAmount(loadedBatch.items, employee.id, "COMPANY_DEDUCTION")),
              additionalEarnings: String(
                isDriver
                  ? itemAmount(loadedBatch.items, employee.id, "ADDITIONAL_EARNING")
                  : Number(payment.additionalEarnings ?? 0),
              ),
              deductions: String(
                isDriver
                  ? itemAmount(loadedBatch.items, employee.id, "DEDUCTION")
                  : Number(payment.deductions ?? 0),
              ),
              notes: payment.notes ?? "",
              attendanceDays: payment.attendanceDays != null ? String(payment.attendanceDays) : "",
              evaluationScore: payment.evaluationScore != null ? String(payment.evaluationScore) : "",
              walletAmount: payment.walletAmount != null ? String(payment.walletAmount) : "",
              amountDeliveredByDriver: payment.amountDeliveredByDriver != null ? String(payment.amountDeliveredByDriver) : "",
            };
          }),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : ar ? arText.loadDataFailed : "Failed to load data");
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [companyId, batchId, ar]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat(ar ? "ar-KW" : "en-US", { month: "long", timeZone: "UTC" }).format(
          new Date(Date.UTC(2026, index, 1)),
        ),
      })),
    [ar],
  );

  function setLineField(employeeId: string, field: keyof PaymentLine, value: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.employeeId !== employeeId) return line;
        const next = { ...line, [field]: value };
        if (line.isDriver && (field === "actualOrders" || field === "targetOrders")) {
          const actual = parseInt(field === "actualOrders" ? value : next.actualOrders || "0", 10) || 0;
          const target = parseInt(field === "targetOrders" ? value : next.targetOrders || "0", 10) || 0;
          const diff = actual - target;
          next.incentive = diff > 0 ? String(round3(diff * INCENTIVE_RATE)) : "0";
          next.targetDeduction = diff < 0 ? String(round3(-diff * INCENTIVE_RATE)) : "0";
        }
        return next;
      }),
    );
  }

  function setLineIncluded(employeeId: string, included: boolean) {
    setLines((prev) =>
      prev.map((line) => (line.employeeId === employeeId ? { ...line, included } : line)),
    );
  }

  function driverNet(line: PaymentLine) {
    return round3(
      n(line.baseAmount) + n(line.incentive) + n(line.foodAllowance) + n(line.companyAddition) +
      n(line.fuelAddition) - n(line.targetDeduction) - n(line.companyDeduction),
    );
  }

  function otherNet(line: PaymentLine) {
    return round3(n(line.baseAmount) + n(line.incentive) + n(line.additionalEarnings) - n(line.deductions));
  }

  function lineNet(line: PaymentLine) {
    return line.isDriver ? driverNet(line) : otherNet(line);
  }

  const includedLines = lines.filter((line) => line.included);
  const removedLines = lines.filter((line) => !line.included);
  const driverLines = includedLines.filter((line) => line.isDriver);
  const otherLines = includedLines.filter((line) => !line.isDriver);
  const totalNet = includedLines.reduce((sum, line) => sum + lineNet(line), 0);

  function employeeFor(employeeId: string) {
    return employees.find((employee) => employee.id === employeeId);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const activeLines = includedLines.filter((line) => n(line.baseAmount) > 0 || lineNet(line) !== 0);
    if (activeLines.length === 0) {
      setError(ar ? arText.atLeastOne : "At least one employee salary is required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/hr/salaries/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          notes: notes || undefined,
          payments: activeLines.map((line) => ({
            employeeId: line.employeeId,
            baseAmount: n(line.baseAmount),
            incentives: n(line.incentive),
            deductions: n(line.deductions),
            additionalEarnings: n(line.additionalEarnings),
            foodAllowance: line.isDriver ? n(line.foodAllowance) : 0,
            companyAddition: line.isDriver ? n(line.companyAddition) : 0,
            fuelAddition: line.isDriver ? n(line.fuelAddition) : 0,
            targetDeduction: line.isDriver ? n(line.targetDeduction) : 0,
            companyDeduction: line.isDriver ? n(line.companyDeduction) : 0,
            targetOrders: line.isDriver ? parseInt(line.targetOrders || "0", 10) || undefined : undefined,
            actualOrders: line.isDriver ? parseInt(line.actualOrders || "0", 10) || undefined : undefined,
            attendanceDays: line.attendanceDays ? n(line.attendanceDays) : undefined,
            evaluationScore: line.evaluationScore ? n(line.evaluationScore) : undefined,
            walletAmount: line.walletAmount ? n(line.walletAmount) : undefined,
            amountDeliveredByDriver: line.amountDeliveredByDriver ? n(line.amountDeliveredByDriver) : undefined,
            notes: line.notes || undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? (ar ? arText.saveFailed : "Failed to save changes"));
      }

      router.push(`/dashboard/companies/${companyId}/hr/salaries/${batchId}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : ar ? arText.unexpected : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  const numInput = "input-field w-full text-left tabular-nums";
  const canEdit = Boolean(
    batch &&
    (batch.status === "DRAFT" || batch.status === "APPROVED") &&
    (batch.journalEntry == null || batch.journalEntry.isDeleted || batch.journalEntry.status !== "POSTED"),
  );

  if (loadingInitial) {
    return <div className="page-container"><p className="text-muted-foreground">{ar ? arText.loading : "Loading..."}</p></div>;
  }

  return (
    <div>
      <Header
        title={ar ? arText.title : "Edit Salary Batch"}
        subtitle={ar ? arText.subtitle : "Update salary batch before posting"}
        companyId={companyId}
      />

      <div className="page-container max-w-[1400px]">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/salaries/${batchId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {ar ? arText.backToBatch : "Back to batch"}
          </Link>
        </div>

        {!canEdit && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {ar ? arText.cannotEdit : "This batch can no longer be edited after posting or final status change."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="section-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {ar ? arText.batchInfo : "Batch information"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{ar ? arText.month : "Month"}</label>
                <select value={month} onChange={(event) => setMonth(parseInt(event.target.value, 10))} className="input-field w-full" disabled={!canEdit}>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{ar ? arText.year : "Year"}</label>
                <select value={year} onChange={(event) => setYear(parseInt(event.target.value, 10))} className="input-field w-full" disabled={!canEdit}>
                  {[2024, 2025, 2026, 2027].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{ar ? arText.notes : "Notes"}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input-field w-full"
                  placeholder={ar ? arText.optionalNotes : "Optional notes"}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          {driverLines.length > 0 && (
            <div className="section-card">
              <div className="mb-4 flex items-center gap-2">
                <Truck size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {ar ? arText.deliveryDrivers : "Delivery drivers"}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-xs">
                      <th className="px-2 py-2 text-right font-bold text-muted-foreground">{ar ? arText.driver : "Driver"}</th>
                      <th className="w-28 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? "إجراء" : "Action"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? arText.baseSalary : "Base"}</th>
                      <th className="w-20 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? arText.target : "Target"}</th>
                      <th className="w-20 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? arText.orders : "Orders"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-green-700">{ar ? arText.incentive : "Incentive"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? arText.food : "Food"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? arText.companyAdd : "Company add"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-blue-700">{ar ? arText.fuel : "Fuel/tire"}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-red-700">{ar ? arText.targetDeduction : "Target ded."}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-red-700">{ar ? arText.companyDeduction : "Company ded."}</th>
                      <th className="w-24 px-2 py-2 text-right font-bold text-muted-foreground">{ar ? arText.net : "Net"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverLines.map((line) => {
                      const employee = employeeFor(line.employeeId);
                      if (!employee) return null;
                      return (
                        <tr key={line.employeeId} className="border-b border-border">
                          <td className="px-2 py-2 font-medium">{employee.nameAr}</td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setLineIncluded(line.employeeId, false)}
                              className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                              disabled={!canEdit}
                            >
                              <Trash2 size={12} />
                              {ar ? arText.removeFromBatch : "Remove"}
                            </button>
                          </td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.baseAmount} onChange={(e) => setLineField(line.employeeId, "baseAmount", e.target.value)} className={numInput} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="1" min="0" value={line.targetOrders} onChange={(e) => setLineField(line.employeeId, "targetOrders", e.target.value)} className={numInput} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="1" min="0" value={line.actualOrders} onChange={(e) => setLineField(line.employeeId, "actualOrders", e.target.value)} className={numInput} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.incentive} onChange={(e) => setLineField(line.employeeId, "incentive", e.target.value)} className={`${numInput} text-green-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.foodAllowance} onChange={(e) => setLineField(line.employeeId, "foodAllowance", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.companyAddition} onChange={(e) => setLineField(line.employeeId, "companyAddition", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.fuelAddition} onChange={(e) => setLineField(line.employeeId, "fuelAddition", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.targetDeduction} onChange={(e) => setLineField(line.employeeId, "targetDeduction", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" min="0" value={line.companyDeduction} onChange={(e) => setLineField(line.employeeId, "companyDeduction", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-2 py-2 text-left"><span className="number font-bold text-emerald-600">{driverNet(line).toFixed(3)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {otherLines.length > 0 && (
            <div className="section-card">
              <div className="mb-4 flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {ar ? arText.otherEmployees : "Other employees"}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">{ar ? arText.employee : "Employee"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-muted-foreground">{ar ? "إجراء" : "Action"}</th>
                      <th className="px-3 py-2 text-right font-bold text-muted-foreground">{ar ? arText.type : "Type"}</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{ar ? arText.baseSalary : "Base salary"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-green-700">{ar ? arText.incentives : "Incentives"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-blue-700">{ar ? arText.additions : "Additions"}</th>
                      <th className="w-28 px-3 py-2 text-right font-bold text-red-700">{ar ? arText.deductions : "Deductions"}</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-muted-foreground">{ar ? arText.net : "Net"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherLines.map((line) => {
                      const employee = employeeFor(line.employeeId);
                      if (!employee) return null;
                      const typeLabel = employeeTypeLabels[employee.type]?.[ar ? "ar" : "en"] ?? employee.type;
                      return (
                        <tr key={line.employeeId} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{employee.nameAr}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setLineIncluded(line.employeeId, false)}
                              className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                              disabled={!canEdit}
                            >
                              <Trash2 size={12} />
                              {ar ? arText.removeFromBatch : "Remove"}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{typeLabel}</td>
                          <td className="px-3 py-2"><input type="number" step="0.001" min="0" value={line.baseAmount} onChange={(e) => setLineField(line.employeeId, "baseAmount", e.target.value)} className={numInput} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-3 py-2"><input type="number" step="0.001" min="0" value={line.incentive} onChange={(e) => setLineField(line.employeeId, "incentive", e.target.value)} className={`${numInput} text-green-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-3 py-2"><input type="number" step="0.001" min="0" value={line.additionalEarnings} onChange={(e) => setLineField(line.employeeId, "additionalEarnings", e.target.value)} className={`${numInput} text-blue-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-3 py-2"><input type="number" step="0.001" min="0" value={line.deductions} onChange={(e) => setLineField(line.employeeId, "deductions", e.target.value)} className={`${numInput} text-red-600`} dir="ltr" disabled={!canEdit} /></td>
                          <td className="px-3 py-2 text-left"><span className="number font-bold text-emerald-600">{otherNet(line).toFixed(3)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {removedLines.length > 0 && (
            <div className="section-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {ar ? arText.removedEmployees : "Removed from this batch"}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {ar ? arText.removeHint : "Removing here only affects the current batch."}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {removedLines.map((line) => {
                  const employee = employeeFor(line.employeeId);
                  if (!employee) return null;
                  return (
                    <button
                      key={line.employeeId}
                      type="button"
                      onClick={() => setLineIncluded(line.employeeId, true)}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                      disabled={!canEdit}
                    >
                      <RotateCcw size={14} />
                      <span>{employee.nameAr}</span>
                      <span className="text-xs text-muted-foreground">
                        {ar ? arText.restoreToBatch : "Restore"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !canEdit}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? (ar ? arText.saving : "Saving...") : ar ? arText.saveChanges : "Save changes"}
              </button>
              <Link
                href={`/dashboard/companies/${companyId}/hr/salaries/${batchId}`}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {ar ? arText.cancel : "Cancel"}
              </Link>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{ar ? arText.totalNet : "Total net:"}</span>{" "}
              <span className="number text-lg font-bold text-emerald-600">{totalNet.toFixed(3)}</span>{" "}
              <span className="text-muted-foreground">{ar ? arText.kwd : "KWD"}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
