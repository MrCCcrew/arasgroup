import * as XLSX from "xlsx";
import type { TrialBalanceRow } from "@/lib/types";

/** Export trial balance to Excel buffer */
export function exportTrialBalanceToExcel(
  rows: TrialBalanceRow[],
  companyName: string,
  year: number
): Buffer {
  const wb = XLSX.utils.book_new();

  const headers = [
    ["كود الحساب", "اسم الحساب", "مدين افتتاحي", "دائن افتتاحي", "مدين الفترة", "دائن الفترة", "مدين ختامي", "دائن ختامي"]
  ];

  const data = rows.map((r) => [
    r.code,
    r.nameAr,
    r.openingDebit || "",
    r.openingCredit || "",
    r.periodDebit || "",
    r.periodCredit || "",
    r.closingDebit || "",
    r.closingCredit || "",
  ]);

  const totalRow = [
    "",
    "الإجمالي",
    rows.reduce((s, r) => s + r.openingDebit, 0).toFixed(3),
    rows.reduce((s, r) => s + r.openingCredit, 0).toFixed(3),
    rows.reduce((s, r) => s + r.periodDebit, 0).toFixed(3),
    rows.reduce((s, r) => s + r.periodCredit, 0).toFixed(3),
    rows.reduce((s, r) => s + r.closingDebit, 0).toFixed(3),
    rows.reduce((s, r) => s + r.closingCredit, 0).toFixed(3),
  ];

  const titleRow = [`${companyName} — ميزان المراجعة ${year}`];

  const ws = XLSX.utils.aoa_to_sheet([
    titleRow,
    [],
    ...headers,
    ...data,
    [],
    totalRow,
  ]);

  // RTL direction
  ws["!dir"] = "RTL";

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 40 },
    { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "ميزان المراجعة");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

/** Export general journal entries to Excel */
export function exportJournalEntriesToExcel(
  entries: Array<{
    number: string;
    date: Date;
    descriptionAr: string;
    type: string;
    totalDebit: unknown;
    status: string;
  }>,
  companyName: string
): Buffer {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    [`${companyName} — القيود اليومية`],
    [],
    ["رقم القيد", "التاريخ", "البيان", "النوع", "إجمالي المدين", "الحالة"],
    ...entries.map((e) => [
      e.number,
      new Date(e.date).toLocaleDateString("ar-KW"),
      e.descriptionAr,
      e.type,
      Number(e.totalDebit).toFixed(3),
      e.status,
    ]),
  ]);

  ws["!dir"] = "RTL";
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 50 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(wb, ws, "القيود اليومية");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/** Export driver wallet statement to Excel */
export function exportDriverWalletToExcel(
  driverName: string,
  transactions: Array<{
    date: Date;
    type: string;
    amount: number;
    balance: number;
    description?: string | null;
  }>
): Buffer {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    [`كشف حساب محفظة السائق: ${driverName}`],
    [],
    ["التاريخ", "النوع", "المبلغ", "الرصيد", "البيان"],
    ...transactions.map((t) => [
      new Date(t.date).toLocaleDateString("ar-KW"),
      t.type,
      t.amount.toFixed(3),
      t.balance.toFixed(3),
      t.description ?? "",
    ]),
  ]);

  ws["!dir"] = "RTL";
  XLSX.utils.book_append_sheet(wb, ws, "كشف محفظة");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/** Export investor statement to Excel */
export function exportInvestorStatementToExcel(
  investorName: string,
  claims: Array<{
    type: string;
    description: string;
    date: Date;
    status: string;
    totalCollected: number;
    totalActual: number;
    totalIncome: number;
    balance: number;
  }>
): Buffer {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([
    [`كشف حساب المستثمر: ${investorName}`],
    [],
    ["النوع", "البيان", "التاريخ", "الحالة", "المجمّع", "الفعلي", "هامش الربح", "الرصيد"],
    ...claims.map((c) => [
      c.type,
      c.description,
      new Date(c.date).toLocaleDateString("ar-KW"),
      c.status,
      c.totalCollected.toFixed(3),
      c.totalActual.toFixed(3),
      c.totalIncome.toFixed(3),
      c.balance.toFixed(3),
    ]),
  ]);

  ws["!dir"] = "RTL";
  XLSX.utils.book_append_sheet(wb, ws, "كشف المستثمر");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
