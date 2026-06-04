import * as XLSX from "xlsx";

export interface TalabatRiderRow {
  riderId: string;
  riderName: string;
  contractName: string;
  companyCode: string;
  completedPickups: number;
  pickupPay: number;
  completedDropoffs: number;
  dropoffPay: number;
  deductions: number;
  totalPayment: number;
}

export interface TalabatRiderSummary {
  riderId: string;
  riderName: string;
  contractName: string;
  companyCode: string;
  rowCount: number;
  totalPickupPay: number;
  totalDropoffPay: number;
  calculatedOrdersRaw: number;
  totalPayment: number;
  totalDeductions: number;
  // Downgraded (Y) sub-totals
  downgradedRowCount: number;
  downgradedPickupPay: number;
  downgradedDropoffPay: number;
  downgradedCalculatedOrders: number;
  downgradedTotalPayment: number;
}

export interface TalabatContractSummary {
  contractName: string;
  companyCode: string;
  totalPickups: number;
  totalPickupPay: number;
  totalDropoffs: number;
  totalDropoffPay: number;
  totalPayment: number;
  contractFee: number;
  brandingFee: number;
  finalPayment: number;
}

export interface TalabatParseResult {
  riders: TalabatRiderSummary[];
  contractSummary: TalabatContractSummary | null;
  totalRows: number;
  errors: string[];
}

const REQUIRED_COLUMNS = [
  "Rider ID",
  "Rider Name",
  "Contract Name",
  "Company Code",
  "Total Admin & Operational Pickup Pay",
  "Total Payment",
];

// Dropoff column has two possible names (old and new format)
const DROPOFF_PAY_COLUMNS = [
  "Total Admin & Operational Dropoff Pay", // Old format
  "Total Admin & Operational Dropoff Total Payment", // New format
];

const OPTIONAL_COLUMNS = [
  "Completed Pickups",
  "Completed Dropoffs",
  "Operator Log in & use to the Rider (operator) App Deductions",
];

export function applyRounding(value: number, mode: string): number {
  switch (mode) {
    case "INTEGER":
      return Math.round(value);
    case "DECIMAL_2":
      return Math.round(value * 100) / 100;
    case "NONE":
    default:
      return value;
  }
}

export function parseTalabatExcel(buffer: Buffer): TalabatParseResult {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return {
      riders: [],
      contractSummary: null,
      totalRows: 0,
      errors: [
        "ملف التقرير غير صالح أو تالف. / Invalid or corrupted report file.",
      ],
    };
  }

  // ── Check Data sheet ──────────────────────────────────────────────────────
  const dataSheetName = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase() === "data"
  );
  if (!dataSheetName) {
    return {
      riders: [],
      contractSummary: null,
      totalRows: 0,
      errors: [
        "ملف التقرير غير صالح. لم يتم العثور على Sheet باسم Data. / Invalid report file. Sheet named Data was not found.",
      ],
    };
  }

  const dataSheet = workbook.Sheets[dataSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(dataSheet, {
    defval: "",
    raw: true,
  });

  if (rawRows.length === 0) {
    return {
      riders: [],
      contractSummary: null,
      totalRows: 0,
      errors: ["Sheet Data فارغ. / Data sheet is empty."],
    };
  }

  // ── Validate required columns ─────────────────────────────────────────────
  const firstRow = rawRows[0];
  const availableColumns = Object.keys(firstRow);

  for (const col of REQUIRED_COLUMNS) {
    if (!availableColumns.includes(col)) {
      errors.push(
        `العمود المطلوب غير موجود: ${col} / Missing required column: ${col}`
      );
    }
  }

  // Check for at least one of the dropoff columns
  const hasDropoffColumn = DROPOFF_PAY_COLUMNS.some(col => availableColumns.includes(col));
  if (!hasDropoffColumn) {
    errors.push(
      `العمود المطلوب غير موجود: أحد الأعمدة التالية مطلوب: ${DROPOFF_PAY_COLUMNS.join(" أو ")} / Missing required column: one of ${DROPOFF_PAY_COLUMNS.join(" or ")}`
    );
  }

  if (errors.length > 0) {
    return { riders: [], contractSummary: null, totalRows: 0, errors };
  }

  // ── Parse rows and group by Rider ID ─────────────────────────────────────
  const riderMap = new Map<string, TalabatRiderSummary>();

  let totalRows = 0;
  for (const row of rawRows) {
    // Normalize Rider ID: always string, trim, no scientific notation
    const rawRiderId = row["Rider ID"];
    if (rawRiderId === "" || rawRiderId === null || rawRiderId === undefined) continue;

    // Excel might format numeric IDs as numbers (e.g. 1400651)
    // Convert to string and remove any decimal Excel artifacts
    let riderId = String(rawRiderId).trim();
    // Handle scientific notation like "1.4e+6"
    if (riderId.includes("e") || riderId.includes("E")) {
      riderId = String(Math.round(Number(riderId)));
    }
    // Remove .0 suffix from Excel numeric cells
    if (/^\d+\.0+$/.test(riderId)) {
      riderId = riderId.split(".")[0];
    }
    if (!riderId) continue;

    totalRows++;

    const riderName = String(row["Rider Name"] ?? "").trim();
    const contractName = String(row["Contract Name"] ?? "").trim();
    const companyCode = String(row["Company Code"] ?? "").trim();
    const pickupPay = parseFloat(String(row["Total Admin & Operational Pickup Pay"] ?? "0")) || 0;

    // Support both old and new dropoff column names
    let dropoffPay = 0;
    for (const colName of DROPOFF_PAY_COLUMNS) {
      if (row[colName] !== undefined && row[colName] !== null && row[colName] !== "") {
        dropoffPay = parseFloat(String(row[colName])) || 0;
        break;
      }
    }

    const deductions = parseFloat(String(row["Operator Log in & use to the Rider (operator) App Deductions"] ?? "0")) || 0;
    const totalPayment = parseFloat(String(row["Total Payment"] ?? "0")) || 0;

    // Check if this row is a "Downgraded" substitute row (Y = worked by another driver)
    const downgradedRaw = String(row["Downgraded (Y/N)"] ?? "").trim().toUpperCase();
    const isDowngraded = downgradedRaw === "Y" || downgradedRaw === "YES";

    const existing = riderMap.get(riderId);
    if (existing) {
      existing.rowCount++;
      existing.totalPickupPay += pickupPay;
      existing.totalDropoffPay += dropoffPay;
      existing.totalDeductions += deductions;
      existing.totalPayment += totalPayment;
      if (!existing.riderName && riderName) existing.riderName = riderName;
      if (!existing.contractName && contractName) existing.contractName = contractName;
      if (!existing.companyCode && companyCode) existing.companyCode = companyCode;
      if (isDowngraded) {
        existing.downgradedRowCount++;
        existing.downgradedPickupPay += pickupPay;
        existing.downgradedDropoffPay += dropoffPay;
        existing.downgradedTotalPayment += totalPayment;
      }
    } else {
      riderMap.set(riderId, {
        riderId,
        riderName,
        contractName,
        companyCode,
        rowCount: 1,
        totalPickupPay: pickupPay,
        totalDropoffPay: dropoffPay,
        calculatedOrdersRaw: 0,
        totalPayment,
        totalDeductions: deductions,
        downgradedRowCount: isDowngraded ? 1 : 0,
        downgradedPickupPay: isDowngraded ? pickupPay : 0,
        downgradedDropoffPay: isDowngraded ? dropoffPay : 0,
        downgradedCalculatedOrders: 0,
        downgradedTotalPayment: isDowngraded ? totalPayment : 0,
      });
    }
  }

  // ── Apply formula: (pickupPay + dropoffPay) / 1.050 ──────────────────────
  const riders: TalabatRiderSummary[] = [];
  for (const rider of riderMap.values()) {
    rider.calculatedOrdersRaw = (rider.totalPickupPay + rider.totalDropoffPay) / 1.050;
    rider.downgradedCalculatedOrders =
      (rider.downgradedPickupPay + rider.downgradedDropoffPay) / 1.050;
    riders.push(rider);
  }

  // ── Parse Contract Summary sheet ─────────────────────────────────────────
  let contractSummary: TalabatContractSummary | null = null;
  const summarySheetName = workbook.SheetNames.find(
    (n) => n.trim().toLowerCase().includes("contract summary")
  );

  if (summarySheetName) {
    try {
      const summarySheet = workbook.Sheets[summarySheetName];
      const summaryRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(summarySheet, {
        defval: "",
        raw: true,
      });

      if (summaryRows.length > 0) {
        const getNum = (row: Record<string, unknown>, key: string) =>
          parseFloat(String(row[key] ?? "0")) || 0;

        // Aggregate contract summary
        let totalPickups = 0, totalPickupPay = 0, totalDropoffs = 0;
        let totalDropoffPay = 0, totalPayment = 0, contractFee = 0;
        let brandingFee = 0, finalPayment = 0;
        let contractName = "", companyCode = "";

        for (const row of summaryRows) {
          totalPickups += getNum(row, "Completed Pickups") || getNum(row, "Total Completed Pickups");
          totalPickupPay += getNum(row, "Total Admin & Operational Pickup Pay") || getNum(row, "Total Pickup Pay");
          totalDropoffs += getNum(row, "Completed Dropoffs") || getNum(row, "Total Completed Dropoffs");

          // Support both old and new dropoff column names in Contract Summary
          let dropoffPayValue = getNum(row, "Total Admin & Operational Dropoff Pay") ||
                                 getNum(row, "Total Admin & Operational Dropoff Total Payment") ||
                                 getNum(row, "Total Dropoff Pay");
          totalDropoffPay += dropoffPayValue;

          totalPayment += getNum(row, "Total Payment");
          contractFee += getNum(row, "Contract Fee");
          brandingFee += getNum(row, "Branding Non-Compliance Fee");
          finalPayment += getNum(row, "Final Payment");
          if (!contractName) contractName = String(row["Contract Name"] ?? "").trim();
          if (!companyCode) companyCode = String(row["Company Code"] ?? "").trim();
        }

        contractSummary = {
          contractName,
          companyCode,
          totalPickups,
          totalPickupPay,
          totalDropoffs,
          totalDropoffPay,
          totalPayment,
          contractFee,
          brandingFee,
          finalPayment,
        };
      }
    } catch {
      // Contract Summary parsing failure is non-fatal
      errors.push("تحذير: لم يتم تحليل ملخص العقد بشكل كامل. / Warning: Could not fully parse Contract Summary sheet.");
    }
  }

  return { riders, contractSummary, totalRows, errors };
}
