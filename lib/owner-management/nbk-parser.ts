import type { NbkVisualRow } from "./pdf-text";
const arabicDigits = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";

export function normalizeNbkText(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .trim();
}

export function normalizeMid(value: string): string | null {
  const normalized = normalizeNbkText(value).replace(/\s/g, "");
  return /^\d{8,12}$/.test(normalized) ? normalized : null;
}

export function extractMid(description: string): string | null {
  const normalized = normalizeNbkText(description);
  return normalizeMid(normalized.match(/\bMID[\s:.-]*([0-9]{8,12})\b/i)?.[1] ?? "");
}

export function extractTransactionReference(description: string): string | null {
  const normalized = normalizeNbkText(description);
  const midMatch = /\bMID[\s:.-]*[0-9]{8,12}\b/i.exec(normalized);
  if (!midMatch) return null;
  return normalized.slice(midMatch.index + midMatch[0].length).match(/\b\d{10,24}\b/)?.[0] ?? null;
}

export type NbkPreviewRow = {
  pageNumber: number; description: string; amount: string; transactionDate?: Date; postingDate?: Date;
  branchCode?: string; balance?: string; mid: string | null; transactionReference: string | null; rawRowText: string; balanceVerified?: boolean;
};

function parseDate(value?: string) {
  if (!value || !/^(?:\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(value)) return undefined;
  const [first, second, third] = value.split("/");
  const normalized = first.length === 4 ? `${first}-${second}-${third}` : `${third}-${second}-${first}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseNbkVisualRows(rows: NbkVisualRow[]): NbkPreviewRow[] {
  return rows.map((row) => ({
    pageNumber: row.pageNumber,
    description: row.description,
    rawRowText: row.rawRowText,
    amount: row.amount ?? "0.000",
    transactionDate: parseDate(row.transactionDate),
    postingDate: parseDate(row.postingDate),
    branchCode: row.branchCode,
    balance: row.balance,
    mid: normalizeMid(row.mid ?? "") ?? extractMid(row.description),
    transactionReference: row.transactionReference ?? extractTransactionReference(row.description),
    balanceVerified: row.balanceVerified,
  }));
}

export function groupNbkOperationLines(page: string): string[] {
  const lines = normalizeNbkText(page).split("\n").map(line => line.trim()).filter(Boolean);
  const startsTransaction = /^-?[\d,]+\.\d{2,3}\s+-?[\d,]+\.\d{2,3}\s+(?:\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{2,4})/;
  const containsMid = /\bMID[\s:.-]*\d{8,12}\b/i;
  const grouped: string[] = [];
  for (const line of lines) {
    if (startsTransaction.test(line) || containsMid.test(line) || grouped.length === 0) grouped.push(line);
    else grouped[grouped.length - 1] += ` ${line}`;
  }
  return grouped;
}

// Parses text already extracted from each PDF page. Keeping extraction separate lets
// the UI show a reviewable preview and avoids persisting uncertain OCR output.
export function parseNbkText(pages: string[]): NbkPreviewRow[] {
  return pages.flatMap((page, pageIndex) => groupNbkOperationLines(page).map((line) => {
    const values = line.match(/-?\d[\d,]*\.\d{3}/g) ?? [];
    const dates = line.match(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g) ?? [];
    const date = dates[0] ? new Date(dates[0].replace(/-/g, "/")) : undefined;
    return { pageNumber: pageIndex + 1, description: line.trim(), rawRowText: line.trim(), amount: (values[1] ?? values[0])?.replace(/,/g, "") ?? "0.000", transactionDate: date, postingDate: dates[1] ? new Date(dates[1].replace(/-/g, "/")) : undefined, branchCode: line.match(/\b\d{4}\b/)?.[0], balance: values[0]?.replace(/,/g, ""), mid: extractMid(line), transactionReference: extractTransactionReference(line) };
  }).filter((row) => row.description.length > 0));
}
