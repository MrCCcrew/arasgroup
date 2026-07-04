import * as XLSX from "xlsx";

// ═══════════════════════════════════════════════════════════════
// Carriage CSV Parser
// For: "Carriage KUW Fleet Partner Cost Dashboard V1_Total Payment_Table.csv"
// ═══════════════════════════════════════════════════════════════

export interface CarriageRiderRow {
  riderId: string;
  riderName: string;
  legalName: string;
  vehicle: string;

  // ── Productivity Metrics ──────────────────────────────────────
  evaluatedHours: number;
  totalCompletedDeliveries: number;
  pickupsCount: number;
  pickupCancellations: number;
  dropoffsCount: number;
  dropoffCancellations: number;

  // ── Rider Settlement (Driver Productivity) ───────────────────
  pickupPayment: number;
  dropoffPayment: number;
  achievementPayment: number;
  operatorDeduction: number;
  riderIncentives: number;
  riderCompensation: number;
  riderDeduction: number;
  riderPositiveAdjustment: number;
  riderNegativeAdjustment: number;

  // ── 3PL Level (intermediate, usually 0 for riders) ───────────
  thirdPartyIncentives: number;
  thirdPartyDeductions: number;
  thirdPartyPositiveAdjustments: number;
  thirdPartyNegativeAdjustments: number;

  netCost: number; // = Driver productivity settlement before fleet deductions

  // ── Fleet Settlement (usually 0 for individual riders) ───────
  codDeficit: number;
  clawbackDeduction: number;
  clawbackRefund: number;
  inventoryDeduction: number;
  inventoryClaim: number;
  thirdPartyOtherDeductions: number;
  contractFees: number;

  netPayment: number; // = Final payment after all fleet deductions
}

export interface CarriageFleetRow {
  // Rows with NO Rider ID and NO Rider Name
  // These are company-level deductions/settlements
  type: "FLEET_DEDUCTION" | "FLEET_ADJUSTMENT";
  description: string;
  codDeficit: number;
  inventoryDeduction: number;
  contractFees: number;
  thirdPartyOtherDeductions: number;
  clawbackDeduction: number;
  clawbackRefund: number;
  netPayment: number;
  rawRow: Record<string, unknown>;
}

export interface CarriageSuspenseRow {
  // Rows with ONLY Rider ID (no name) OR ONLY Rider Name (no ID)
  // These need manual review
  riderId?: string;
  riderName?: string;
  reason: string;
  inventoryDeduction: number;
  codDeficit: number;
  contractFees: number;
  netCost: number;
  netPayment: number;
  rawRow: Record<string, unknown>;
}

export interface CarriageParseResult {
  reportType: "CARRIAGE_CSV";
  riders: CarriageRiderRow[];
  fleetRows: CarriageFleetRow[];
  suspenseRows: CarriageSuspenseRow[];
  totalDataRows: number;
  errors: string[];
  warnings: string[];

  // ── Totals for Validation ─────────────────────────────────────
  totals: {
    // Rider productivity totals
    completedDeliveries: number;
    evaluatedHours: number;
    pickupPayment: number;
    dropoffPayment: number;
    achievementPayment: number;
    operatorDeduction: number;
    netCost: number;

    // Fleet settlement totals
    codDeficit: number;
    inventoryDeduction: number;
    contractFees: number;
    netPayment: number;
  };
}

const REQUIRED_COLUMNS = [
  "Month",
  "Year",
  "Total Completed Deliveries",
  "Pickup Payment",
  "Dropoff Payment",
  "Net Cost",
  "Net Payment",
];

const OPTIONAL_COLUMNS = [
  "Rider ID",
  "Rider Name",
  "3PL Legal Name",
  "Vehicle",
  "Evaluated Hours",
  "Pickups Count",
  "Pickup Cancellations",
  "Dropoffs Count",
  "Dropoff Cancellations",
  "Service-Level Based Achievement total Payment",
  "Operator Log in & use to the Rider (operator) App Deductions",
  "Rider Manual Incentives Calc",
  "Rider Compensation",
  "Rider Deduction",
  "Rider Positive Adjustment",
  "Rider Negative Adjustment",
  "3PL Incentives",
  "3PL Deductions",
  "3PL Positive Adjustments",
  "3PL Negative Adjustments",
  "COD Deficit",
  "Clawback Deduction",
  "Clawback Refund",
  "Inventory Deduction",
  "Inventory Claim",
  "3PL Other Deductions",
  "Contract fees",
];

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(num) ? 0 : num;
}

function parseString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseCarriageCSV(buffer: Buffer): CarriageParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Parse CSV ──────────────────────────────────────────────────
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    return {
      reportType: "CARRIAGE_CSV",
      riders: [],
      fleetRows: [],
      suspenseRows: [],
      totalDataRows: 0,
      errors: ["ملف CSV غير صالح أو تالف / Invalid or corrupted CSV file"],
      warnings: [],
      totals: {
        completedDeliveries: 0,
        evaluatedHours: 0,
        pickupPayment: 0,
        dropoffPayment: 0,
        achievementPayment: 0,
        operatorDeduction: 0,
        netCost: 0,
        codDeficit: 0,
        inventoryDeduction: 0,
        contractFees: 0,
        netPayment: 0,
      },
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    errors.push("الملف فارغ / File is empty");
    return {
      reportType: "CARRIAGE_CSV",
      riders: [],
      fleetRows: [],
      suspenseRows: [],
      totalDataRows: 0,
      errors,
      warnings: [],
      totals: {
        completedDeliveries: 0,
        evaluatedHours: 0,
        pickupPayment: 0,
        dropoffPayment: 0,
        achievementPayment: 0,
        operatorDeduction: 0,
        netCost: 0,
        codDeficit: 0,
        inventoryDeduction: 0,
        contractFees: 0,
        netPayment: 0,
      },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (rawRows.length === 0) {
    errors.push("الملف لا يحتوي على بيانات / File contains no data");
    return {
      reportType: "CARRIAGE_CSV",
      riders: [],
      fleetRows: [],
      suspenseRows: [],
      totalDataRows: 0,
      errors,
      warnings: [],
      totals: {
        completedDeliveries: 0,
        evaluatedHours: 0,
        pickupPayment: 0,
        dropoffPayment: 0,
        achievementPayment: 0,
        operatorDeduction: 0,
        netCost: 0,
        codDeficit: 0,
        inventoryDeduction: 0,
        contractFees: 0,
        netPayment: 0,
      },
    };
  }

  // ── Validate columns ───────────────────────────────────────────
  const firstRow = rawRows[0];
  const availableColumns = Object.keys(firstRow);

  for (const col of REQUIRED_COLUMNS) {
    if (!availableColumns.includes(col)) {
      errors.push(`العمود المطلوب غير موجود: ${col} / Missing required column: ${col}`);
    }
  }

  if (errors.length > 0) {
    return {
      reportType: "CARRIAGE_CSV",
      riders: [],
      fleetRows: [],
      suspenseRows: [],
      totalDataRows: 0,
      errors,
      warnings: [],
      totals: {
        completedDeliveries: 0,
        evaluatedHours: 0,
        pickupPayment: 0,
        dropoffPayment: 0,
        achievementPayment: 0,
        operatorDeduction: 0,
        netCost: 0,
        codDeficit: 0,
        inventoryDeduction: 0,
        contractFees: 0,
        netPayment: 0,
      },
    };
  }

  // ── Parse rows and categorize ──────────────────────────────────
  const riders: CarriageRiderRow[] = [];
  const fleetRows: CarriageFleetRow[] = [];
  const suspenseRows: CarriageSuspenseRow[] = [];

  let totalDataRows = 0;

  for (const row of rawRows) {
    totalDataRows++;

    const riderId = parseString(row["Rider ID"]);
    const riderName = parseString(row["Rider Name"]);

    // ── Case 1: No Rider ID AND No Rider Name → Fleet-level row ──
    if (!riderId && !riderName) {
      const codDeficit = parseNumber(row["COD Deficit"]);
      const inventoryDeduction = parseNumber(row["Inventory Deduction"]);
      const contractFees = parseNumber(row["Contract fees"]);
      const thirdPartyOtherDeductions = parseNumber(row["3PL Other Deductions"]);
      const clawbackDeduction = parseNumber(row["Clawback Deduction"]);
      const clawbackRefund = parseNumber(row["Clawback Refund"]);
      const netPayment = parseNumber(row["Net Payment"]);

      // Only add if there's actual data (not all zeros)
      if (
        codDeficit !== 0 ||
        inventoryDeduction !== 0 ||
        contractFees !== 0 ||
        thirdPartyOtherDeductions !== 0 ||
        clawbackDeduction !== 0 ||
        clawbackRefund !== 0 ||
        netPayment !== 0
      ) {
        const legalName = parseString(row["3PL Legal Name"]);
        fleetRows.push({
          type: "FLEET_DEDUCTION",
          description: legalName || "Fleet-level deduction",
          codDeficit,
          inventoryDeduction,
          contractFees,
          thirdPartyOtherDeductions,
          clawbackDeduction,
          clawbackRefund,
          netPayment,
          rawRow: row,
        });

        warnings.push(
          `صف بدون Rider ID/Name: ${legalName || "Fleet deduction"} - صافي الدفع: ${netPayment} د.ك / Row without Rider ID/Name: Fleet deduction - Net Payment: ${netPayment} KWD`
        );
      }
      continue;
    }

    // ── Case 2: Rider ID exists but NO Rider Name (or vice versa) → Suspense ──
    if (!riderId || !riderName) {
      const reason = !riderId
        ? "Rider ID فارغ / Missing Rider ID"
        : "Rider Name فارغ / Missing Rider Name";

      suspenseRows.push({
        riderId: riderId || undefined,
        riderName: riderName || undefined,
        reason,
        inventoryDeduction: parseNumber(row["Inventory Deduction"]),
        codDeficit: parseNumber(row["COD Deficit"]),
        contractFees: parseNumber(row["Contract fees"]),
        netCost: parseNumber(row["Net Cost"]),
        netPayment: parseNumber(row["Net Payment"]),
        rawRow: row,
      });

      warnings.push(
        `${reason}: ${riderId || riderName} - صافي الدفع: ${parseNumber(row["Net Payment"])} د.ك / ${reason}: ${riderId || riderName} - Net Payment: ${parseNumber(row["Net Payment"])} KWD`
      );
      continue;
    }

    // ── Case 3: Both Rider ID and Rider Name exist → Valid rider row ──
    const rider: CarriageRiderRow = {
      riderId,
      riderName,
      legalName: parseString(row["3PL Legal Name"]),
      vehicle: parseString(row["Vehicle"]),

      // Productivity
      evaluatedHours: parseNumber(row["Evaluated Hours"]),
      totalCompletedDeliveries: parseNumber(row["Total Completed Deliveries"]),
      pickupsCount: parseNumber(row["Pickups Count"]),
      pickupCancellations: parseNumber(row["Pickup Cancellations"]),
      dropoffsCount: parseNumber(row["Dropoffs Count"]),
      dropoffCancellations: parseNumber(row["Dropoff Cancellations"]),

      // Rider settlement
      pickupPayment: parseNumber(row["Pickup Payment"]),
      dropoffPayment: parseNumber(row["Dropoff Payment"]),
      achievementPayment: parseNumber(row["Service-Level Based Achievement total Payment"]),
      operatorDeduction: parseNumber(row["Operator Log in & use to the Rider (operator) App Deductions"]),
      riderIncentives: parseNumber(row["Rider Manual Incentives Calc"]),
      riderCompensation: parseNumber(row["Rider Compensation"]),
      riderDeduction: parseNumber(row["Rider Deduction"]),
      riderPositiveAdjustment: parseNumber(row["Rider Positive Adjustment"]),
      riderNegativeAdjustment: parseNumber(row["Rider Negative Adjustment"]),

      // 3PL level
      thirdPartyIncentives: parseNumber(row["3PL Incentives"]),
      thirdPartyDeductions: parseNumber(row["3PL Deductions"]),
      thirdPartyPositiveAdjustments: parseNumber(row["3PL Positive Adjustments"]),
      thirdPartyNegativeAdjustments: parseNumber(row["3PL Negative Adjustments"]),

      netCost: parseNumber(row["Net Cost"]),

      // Fleet settlement (usually 0 for individual riders)
      codDeficit: parseNumber(row["COD Deficit"]),
      clawbackDeduction: parseNumber(row["Clawback Deduction"]),
      clawbackRefund: parseNumber(row["Clawback Refund"]),
      inventoryDeduction: parseNumber(row["Inventory Deduction"]),
      inventoryClaim: parseNumber(row["Inventory Claim"]),
      thirdPartyOtherDeductions: parseNumber(row["3PL Other Deductions"]),
      contractFees: parseNumber(row["Contract fees"]),

      netPayment: parseNumber(row["Net Payment"]),
    };

    riders.push(rider);

    // ── Warning: Operator Deduction detected ──
    if (rider.operatorDeduction !== 0) {
      warnings.push(
        `تحذير: Operator Deduction للسائق ${rider.riderName} (${rider.riderId}): ${rider.operatorDeduction} د.ك - قد يكون الحساب مستخدم من سائق آخر / Warning: Operator Deduction for ${rider.riderName}: ${rider.operatorDeduction} KWD - Account may be used by another driver`
      );
    }

    // ── Warning: Fleet-level deduction on rider row ──
    if (
      rider.codDeficit !== 0 ||
      rider.inventoryDeduction !== 0 ||
      rider.contractFees !== 0
    ) {
      warnings.push(
        `تحذير: خصومات Fleet على مستوى السائق ${rider.riderName} (${rider.riderId}) - COD: ${rider.codDeficit}, Inventory: ${rider.inventoryDeduction}, Fees: ${rider.contractFees} / Warning: Fleet deductions on rider ${rider.riderName}`
      );
    }
  }

  // ── Calculate totals ───────────────────────────────────────────
  const totals = {
    completedDeliveries: 0,
    evaluatedHours: 0,
    pickupPayment: 0,
    dropoffPayment: 0,
    achievementPayment: 0,
    operatorDeduction: 0,
    netCost: 0,
    codDeficit: 0,
    inventoryDeduction: 0,
    contractFees: 0,
    netPayment: 0,
  };

  // Riders totals
  for (const rider of riders) {
    totals.completedDeliveries += rider.totalCompletedDeliveries;
    totals.evaluatedHours += rider.evaluatedHours;
    totals.pickupPayment += rider.pickupPayment;
    totals.dropoffPayment += rider.dropoffPayment;
    totals.achievementPayment += rider.achievementPayment;
    totals.operatorDeduction += rider.operatorDeduction;
    totals.netCost += rider.netCost;
    totals.codDeficit += rider.codDeficit;
    totals.inventoryDeduction += rider.inventoryDeduction;
    totals.contractFees += rider.contractFees;
    totals.netPayment += rider.netPayment;
  }

  // Fleet rows totals
  for (const fleet of fleetRows) {
    totals.codDeficit += fleet.codDeficit;
    totals.inventoryDeduction += fleet.inventoryDeduction;
    totals.contractFees += fleet.contractFees;
    totals.netPayment += fleet.netPayment;
  }

  // Suspense rows totals
  for (const suspense of suspenseRows) {
    totals.codDeficit += suspense.codDeficit;
    totals.inventoryDeduction += suspense.inventoryDeduction;
    totals.contractFees += suspense.contractFees;
    totals.netCost += suspense.netCost;
    totals.netPayment += suspense.netPayment;
  }

  return {
    reportType: "CARRIAGE_CSV",
    riders,
    fleetRows,
    suspenseRows,
    totalDataRows,
    errors,
    warnings,
    totals,
  };
}
