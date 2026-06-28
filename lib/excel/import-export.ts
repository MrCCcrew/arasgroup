import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ColDef {
  header: string;           // Arabic header displayed in Excel
  key: string;              // object key used in parsed row
  example?: string;         // example shown in row 2 of template
  required?: boolean;
  width?: number;           // column width in chars
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

// ── Date parsing ──────────────────────────────────────────────────────────────
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  // Excel numeric date
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }

  const str = String(value).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);

  // Pure number → Excel serial date (e.g. 45297 = 2023-12-01)
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str, 10);
    if (serial > 0 && serial < 99999) {
      const d = XLSX.SSF.parse_date_code(serial);
      if (d && d.y >= 1900 && d.y <= 2100) return new Date(d.y, d.m - 1, d.d);
    }
    return null; // Reject huge numbers like civil IDs
  }

  // ISO or other string formats — only accept if year is sane
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) return d;
  return null;
}

export function formatDateForExcel(d: Date | null | undefined): string {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Enum helpers ──────────────────────────────────────────────────────────────
export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  "سائق": "DRIVER",
  "سائق توصيل": "DELIVERY_DRIVER",
  "مشرف توصيل": "DELIVERY_ADMIN",
  "سائق غسيل": "CAR_WASH_DRIVER",
  "عامل غسيل": "CAR_WASH_WORKER",
  "موظف إداري": "OFFICE_EMPLOYEE",
  "محاسب": "ACCOUNTANT",
  "مندوب": "MANDOUB",
  "ساعي": "OFFICE_BOY",
  "أخرى": "OTHER",
};

export const EMPLOYEE_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(EMPLOYEE_TYPE_LABELS).map(([ar, en]) => [en, ar])
);

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  "توصيل": "DELIVERY",
  "غسيل سيارات": "CAR_WASH",
  "إداري": "ADMIN",
};

export const VEHICLE_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(VEHICLE_TYPE_LABELS).map(([ar, en]) => [en, ar])
);

export function parseEnum<T extends string>(
  value: unknown,
  labelMap: Record<string, string>,
  enumValues: T[],
): T | null {
  if (!value) return null;
  const str = String(value).trim();
  // Direct enum value
  if (enumValues.includes(str as T)) return str as T;
  // Arabic label
  const mapped = labelMap[str];
  if (mapped && enumValues.includes(mapped as T)) return mapped as T;
  return null;
}

export function normalizeLookupValue(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

// ── Excel builder ─────────────────────────────────────────────────────────────
export function buildWorkbook(
  cols: ColDef[],
  rows: Record<string, unknown>[],
  sheetName = "البيانات",
  includeExampleRow = false,
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: sheetName };

  const aoa: unknown[][] = [];

  // Header row
  aoa.push(cols.map((c) => c.header));

  // Example / instructions row
  if (includeExampleRow) {
    aoa.push(cols.map((c) => c.example ?? ""));
  }

  // Data rows
  for (const row of rows) {
    aoa.push(cols.map((c) => row[c.key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws["!cols"] = cols.map((c) => ({ wch: c.width ?? 20 }));

  // RTL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)["!sheetView"] = [{ rightToLeft: true }];

  // Style header row
  cols.forEach((_, ci) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F3864" } },
        alignment: { horizontal: "center", vertical: "center", readingOrder: 2 },
      };
    }
  });

  // Style example row
  if (includeExampleRow) {
    cols.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: 1, c: ci });
      if (ws[cell]) {
        ws[cell].s = {
          font: { italic: true, color: { rgb: "888888" } },
          fill: { fgColor: { rgb: "F2F2F2" } },
        };
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const raw: Buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true }));
  const ab = new ArrayBuffer(raw.byteLength);
  new Uint8Array(ab).set(raw);
  return ab;
}

// ── Excel parser ──────────────────────────────────────────────────────────────
export function parseWorkbook(
  buffer: Buffer,
  cols: ColDef[],
  skipRows = 2, // skip header + example rows
): Array<{ rowIndex: number; data: Record<string, string> }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  const results: Array<{ rowIndex: number; data: Record<string, string> }> = [];

  for (let i = skipRows; i < aoa.length; i++) {
    const row = aoa[i] as unknown[];
    // Skip completely empty rows
    if (row.every((cell) => cell === "" || cell === null || cell === undefined)) continue;

    const data: Record<string, string> = {};
    cols.forEach((col, ci) => {
      const val = row[ci];
      data[col.key] = val !== undefined && val !== null ? String(val).trim() : "";
    });
    results.push({ rowIndex: i + 1, data }); // 1-based for user-friendly error messages
  }

  return results;
}

// ── Validators ────────────────────────────────────────────────────────────────
export function validateRequired(
  rows: Array<{ rowIndex: number; data: Record<string, string> }>,
  cols: ColDef[],
): Array<{ row: number; field?: string; message: string }> {
  const errors: Array<{ row: number; field?: string; message: string }> = [];
  const required = cols.filter((c) => c.required);

  for (const { rowIndex, data } of rows) {
    for (const col of required) {
      if (!data[col.key]) {
        errors.push({
          row: rowIndex,
          field: col.header,
          message: `الصف ${rowIndex}: حقل "${col.header}" مطلوب`,
        });
      }
    }
  }
  return errors;
}
