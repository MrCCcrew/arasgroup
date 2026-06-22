// Extract invoice amount/date from OCR text.
// Pure utility used in the browser after tesseract runs.

const TOTAL_KEYWORDS = [
  "grand total",
  "total amount",
  "total",
  "الإجمالي",
  "الاجمالي",
  "اجمالي",
  "المجموع",
];

const AMOUNT_KEYWORDS = [
  "amount",
  "net",
  "مبلغ",
  "قيمة",
  "الصافي",
];

const CURRENCY_KEYWORDS = [
  "kwd",
  "kd",
  "د.ك",
  "دك",
];

const IGNORE_AMOUNT_KEYWORDS = [
  "date",
  "time",
  "shift",
  "site",
  "pump",
  "price",
  "qty",
  "quantity",
  "no",
  "station",
  "محطة",
  "مضخة",
  "الكمية",
  "سعر اللتر",
  "رقم",
];

const DATE_HINT_KEYWORDS = ["date", "التاريخ"];
const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const ISO_DATE_RE = /\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/g;
const DMY_DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
const NUMBER_RE = /\b\d+(?:[.,]\d{1,3})?\b/g;

function normalizeDigits(input: string): string {
  return (input || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

function normalizeText(input: string): string {
  return normalizeDigits(input).replace(/\s+/g, " ").trim();
}

function toIso(y: string, mo: string, d: string): string | null {
  const Y = Number(y.length === 2 ? `20${y}` : y);
  const M = Number(mo);
  const D = Number(d);
  if (!Y || M < 1 || M > 12 || D < 1 || D > 31 || Y < 2000 || Y > 2100) return null;
  return `${Y}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}`;
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function isTimeToken(token: string): boolean {
  return token.includes(":");
}

function isDateToken(token: string): boolean {
  return /\d[\/.\-]\d/.test(token) && (token.match(/[\/.\-]/g)?.length ?? 0) >= 2;
}

function parseAmountToken(token: string): number | null {
  if (!token || isTimeToken(token) || isDateToken(token)) return null;

  let normalized = token.trim();
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d+,\d{1,3}$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getLineCandidates(line: string): number[] {
  const cleaned = line.replace(TIME_RE, " ");
  const out: number[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(NUMBER_RE);

  while ((match = re.exec(cleaned))) {
    const token = match[0];
    const value = parseAmountToken(token);
    if (value != null) out.push(value);
  }

  return out;
}

function pickBestFromLine(line: string): number | null {
  const candidates = getLineCandidates(line);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1] ?? null;
}

function getFallbackCandidates(lines: string[]): number[] {
  const out: number[] = [];

  for (const rawLine of lines) {
    const line = normalizeText(rawLine);
    const lower = line.toLowerCase();
    if (!line) continue;
    if (containsAny(lower, IGNORE_AMOUNT_KEYWORDS)) continue;
    out.push(...getLineCandidates(line));
  }

  return out;
}

export function extractDate(raw: string): string | null {
  const text = normalizeDigits(raw);
  const withoutTimes = text.replace(TIME_RE, " ");
  const lines = withoutTimes.split(/\r?\n+/);

  for (const rawLine of lines) {
    const line = normalizeText(rawLine);
    const lower = line.toLowerCase();
    if (!line) continue;
    if (!containsAny(lower, DATE_HINT_KEYWORDS)) continue;

    let match: RegExpExecArray | null;
    const isoRe = new RegExp(ISO_DATE_RE);
    while ((match = isoRe.exec(line))) {
      const iso = toIso(match[1], match[2], match[3]);
      if (iso) return iso;
    }

    const dmyRe = new RegExp(DMY_DATE_RE);
    while ((match = dmyRe.exec(line))) {
      const iso = toIso(match[3], match[2], match[1]);
      if (iso) return iso;
    }
  }

  let match: RegExpExecArray | null;
  const isoRe = new RegExp(ISO_DATE_RE);
  while ((match = isoRe.exec(withoutTimes))) {
    const iso = toIso(match[1], match[2], match[3]);
    if (iso) return iso;
  }

  const dmyRe = new RegExp(DMY_DATE_RE);
  while ((match = dmyRe.exec(withoutTimes))) {
    const iso = toIso(match[3], match[2], match[1]);
    if (iso) return iso;
  }

  return null;
}

export function extractAmount(raw: string): number | null {
  const lines = normalizeDigits(raw).split(/\r?\n+/);
  const totalMatches: number[] = [];
  const amountMatches: number[] = [];
  const currencyMatches: number[] = [];

  for (const rawLine of lines) {
    const line = normalizeText(rawLine);
    const lower = line.toLowerCase();
    if (!line) continue;

    const candidate = pickBestFromLine(line);
    if (candidate == null) continue;

    if (containsAny(lower, TOTAL_KEYWORDS)) {
      totalMatches.push(candidate);
      continue;
    }

    if (containsAny(lower, AMOUNT_KEYWORDS)) {
      amountMatches.push(candidate);
      continue;
    }

    if (containsAny(lower, CURRENCY_KEYWORDS) && !containsAny(lower, IGNORE_AMOUNT_KEYWORDS)) {
      currencyMatches.push(candidate);
    }
  }

  if (totalMatches.length > 0) return totalMatches[totalMatches.length - 1];
  if (amountMatches.length > 0) return amountMatches[amountMatches.length - 1];
  if (currencyMatches.length > 0) return currencyMatches[currencyMatches.length - 1];

  const fallback = getFallbackCandidates(lines);
  if (fallback.length === 0) return null;
  return Math.max(...fallback);
}

export function parseInvoiceText(raw: string): { amount: number | null; date: string | null } {
  return { amount: extractAmount(raw), date: extractDate(raw) };
}

/*
Examples:

parseInvoiceText(`
ALFA FUEL STATION
RECEIPT
PAYMENT TYPE: Cash Payment
DATE 15:56:51 21-06-2026
SHIFT 1
Pump: 7
PRODUCT : Pr
Price 0.085
QTY 29.39
AMOUNT 2.500
TOTAL : 2.500 KWD
`)
=> { amount: 2.5, date: "2026-06-21" }
*/
