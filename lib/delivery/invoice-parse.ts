// Extract invoice amount/date suggestions from OCR text.
// These helpers are intentionally conservative: they prefer returning null
// over filling a weak amount candidate that the user must later fix manually.

const TOTAL_KEYWORDS = [
  "grand total",
  "total amount",
  "paymentamount",
  "payment amount",
  "total",
  "الإجمالي",
  "الاجمالي",
  "اجمالي",
  "المجموع",
  "المبلغ الإجمالي",
];

const AMOUNT_KEYWORDS = [
  "amount",
  "net",
  "مبلغ",
  "المبلغ",
  "قيمة",
  "الصافي",
];

const CURRENCY_KEYWORDS = [
  "kwd",
  "kd",
  "k.d.",
  "k.d",
  "د.ك",
  "دك",
  "دينار",
];

const FILS_KEYWORDS = ["fils", "فلس"];

const STRONG_NEGATIVE_KEYWORDS = [
  "date",
  "time",
  "terminal",
  "receipt no",
  "receipt",
  "invoice no",
  "invoice",
  "no.",
  "no ",
  "pump",
  "shift",
  "site",
  "station",
  "tel",
  "phone",
  "التاريخ",
  "الهاتف",
  "الفاتورة",
  "المضخة",
  "المحطة",
  "رقم",
];

const SOFT_NEGATIVE_KEYWORDS = [
  "quantity",
  "qty",
  "unit price",
  "price",
  "سعر الوحدة",
  "الكمية",
  "سعر اللتر",
];

const DATE_HINT_KEYWORDS = ["date", "التاريخ"];

const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const ISO_DATE_RE = /\b(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/g;
const DMY_DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
const NUMBER_RE = /\b\d+(?:[.,]\d{1,3})?\b/g;

type AmountCandidate = {
  value: number;
  score: number;
  lineIndex: number;
  reason: "total" | "amount" | "currency" | "fallback" | "kd-fils";
  raw: string;
};

type NumberToken = {
  raw: string;
  value: number;
  index: number;
  decimals: number;
};

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
  const year = Number(y.length === 2 ? `20${y}` : y);
  const month = Number(mo);
  const day = Number(d);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function parseAmountToken(rawToken: string): NumberToken | null {
  if (!rawToken || isTimeToken(rawToken) || isDateToken(rawToken)) return null;

  let normalized = rawToken.trim();
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d+,\d{1,3}$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  const decimalPart = normalized.split(".")[1] ?? "";
  return {
    raw: rawToken,
    value,
    index: -1,
    decimals: decimalPart.length,
  };
}

function getLineNumberTokens(line: string): NumberToken[] {
  const cleaned = line.replace(TIME_RE, " ");
  const tokens: NumberToken[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(NUMBER_RE);

  while ((match = re.exec(cleaned))) {
    const parsed = parseAmountToken(match[0]);
    if (!parsed) continue;
    tokens.push({ ...parsed, index: match.index });
  }

  return tokens;
}

function buildKdFilsValue(dinarToken: NumberToken, filsToken?: NumberToken | null): number | null {
  if (dinarToken.decimals > 0) return dinarToken.value;
  if (!filsToken) return Number(dinarToken.value.toFixed(3));
  if (filsToken.decimals > 0) return null;

  const digitsOnly = filsToken.raw.replace(/\D/g, "");
  if (!digitsOnly) return Number(dinarToken.value.toFixed(3));
  if (digitsOnly.length !== 3) return null;

  const fils = Number(digitsOnly);
  if (!Number.isInteger(fils) || fils < 0 || fils > 999) return null;
  return Number((dinarToken.value + fils / 1000).toFixed(3));
}

function buildInlineGroupedValue(tokens: NumberToken[]): number | null {
  if (tokens.length < 2) return null;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = tokens[i];
    const second = tokens[i + 1];
    if (first.decimals > 0) continue;
    if (second.decimals > 0) continue;
    const secondDigits = second.raw.replace(/\D/g, "");
    if (secondDigits.length !== 3) continue;
    const value = buildKdFilsValue(first, second);
    if (value != null) return value;
  }
  return null;
}

function getLineBaseScore(lower: string): { score: number; reason: AmountCandidate["reason"] | null } {
  if (containsAny(lower, TOTAL_KEYWORDS)) return { score: 120, reason: "total" };
  if (containsAny(lower, AMOUNT_KEYWORDS)) return { score: 90, reason: "amount" };
  if (containsAny(lower, CURRENCY_KEYWORDS) || containsAny(lower, FILS_KEYWORDS)) return { score: 70, reason: "currency" };
  return { score: 10, reason: "fallback" };
}

function hasBlockingNegativeKeywords(lower: string, hasPositiveKeyword: boolean): boolean {
  if (hasPositiveKeyword) return false;
  return containsAny(lower, STRONG_NEGATIVE_KEYWORDS) || containsAny(lower, SOFT_NEGATIVE_KEYWORDS);
}

function scoreToken(line: string, lower: string, token: NumberToken, lineIndex: number): AmountCandidate | null {
  if (isTimeToken(token.raw) || isDateToken(token.raw)) return null;

  const { score: baseScore, reason } = getLineBaseScore(lower);
  const hasPositiveKeyword = reason !== "fallback";
  if (hasBlockingNegativeKeywords(lower, hasPositiveKeyword)) return null;

  let score = baseScore;
  if (token.decimals === 3) score += 12;
  else if (token.decimals > 0) score += 6;
  else if (hasPositiveKeyword) score += 2;

  if (token.decimals === 0 && reason === "currency") {
    score -= 5;
  }

  const trailingText = lower.slice(token.index);
  if (containsAny(trailingText, CURRENCY_KEYWORDS)) score += 8;
  if (containsAny(trailingText, TOTAL_KEYWORDS)) score += 4;
  if (containsAny(trailingText, AMOUNT_KEYWORDS)) score += 2;

  return {
    value: token.decimals === 0 && hasPositiveKeyword ? Number(token.value.toFixed(3)) : token.value,
    score,
    lineIndex,
    reason: reason ?? "fallback",
    raw: line,
  };
}

function getAmountCandidates(lines: string[]): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  let pendingDinar: { token: NumberToken; lineIndex: number } | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = normalizeText(lines[lineIndex]);
    const lower = line.toLowerCase();
    if (!line) continue;

    const tokens = getLineNumberTokens(line);
    const { score: baseScore, reason } = getLineBaseScore(lower);
    const hasPositiveKeyword = reason !== "fallback";

    if (hasBlockingNegativeKeywords(lower, hasPositiveKeyword)) {
      pendingDinar = null;
      continue;
    }

    const inlineGrouped = buildInlineGroupedValue(tokens);
    if (inlineGrouped != null && hasPositiveKeyword) {
      candidates.push({
        value: inlineGrouped,
        score: baseScore + 25,
        lineIndex,
        reason: "kd-fils",
        raw: line,
      });
    }

    for (const token of tokens) {
      const candidate = scoreToken(line, lower, token, lineIndex);
      if (candidate) candidates.push(candidate);
    }

    const hasDinarKeyword = containsAny(lower, CURRENCY_KEYWORDS);
    const hasFilsKeyword = containsAny(lower, FILS_KEYWORDS);

    if (hasDinarKeyword && !hasFilsKeyword && tokens.length > 0) {
      pendingDinar = { token: tokens[0], lineIndex };
      if (tokens.length === 1 && !hasPositiveKeyword) {
        const kdOnly = buildKdFilsValue(tokens[0], null);
        if (kdOnly != null) {
          candidates.push({
            value: kdOnly,
            score: baseScore + 8,
            lineIndex,
            reason: "kd-fils",
            raw: line,
          });
        }
      }
      continue;
    }

    if (hasFilsKeyword && pendingDinar && lineIndex - pendingDinar.lineIndex <= 2) {
      const filsToken = tokens[0] ?? null;
      const value = buildKdFilsValue(pendingDinar.token, filsToken);
      if (value != null) {
        candidates.push({
          value,
          score: 88,
          lineIndex,
          reason: "kd-fils",
          raw: `${lines[pendingDinar.lineIndex]} | ${line}`,
        });
      }
      pendingDinar = null;
      continue;
    }

    if (!hasDinarKeyword) pendingDinar = null;
  }

  return candidates;
}

function chooseBestAmountCandidate(candidates: AmountCandidate[]): number | null {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const reasonRank = { total: 4, amount: 3, "kd-fils": 2, currency: 1, fallback: 0 } as const;
    if (reasonRank[b.reason] !== reasonRank[a.reason]) return reasonRank[b.reason] - reasonRank[a.reason];
    return b.value - a.value;
  });

  const top = sorted[0];
  if (top.score < 40) return null;

  const conflicting = sorted.filter((candidate) => candidate.score === top.score && candidate.value !== top.value);
  if (conflicting.length > 0 && top.reason === "fallback") return null;

  return Number(top.value.toFixed(3));
}

function findDateInText(text: string): string | null {
  let match: RegExpExecArray | null;

  const isoRe = new RegExp(ISO_DATE_RE);
  while ((match = isoRe.exec(text))) {
    const iso = toIso(match[1], match[2], match[3]);
    if (iso) return iso;
  }

  const dmyRe = new RegExp(DMY_DATE_RE);
  while ((match = dmyRe.exec(text))) {
    const iso = toIso(match[3], match[2], match[1]);
    if (iso) return iso;
  }

  return null;
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

    const date = findDateInText(line);
    if (date) return date;
  }

  return findDateInText(withoutTimes);
}

export function extractAmount(raw: string): number | null {
  const lines = normalizeDigits(raw).split(/\r?\n+/);
  return chooseBestAmountCandidate(getAmountCandidates(lines));
}

export function extractInvoiceDateFromOcrText(text: string): string | null {
  return extractDate(text);
}

export function extractInvoiceAmountFromOcrText(text: string): number | null {
  return extractAmount(text);
}

export function parseInvoiceText(raw: string): { amount: number | null; date: string | null } {
  return { amount: extractAmount(raw), date: extractDate(raw) };
}

/*
Examples:

parseInvoiceText(`
ALFA FUEL STATION
DATE 15:56:51 21-06-2026
SHIFT 1
Pump: 7
Price 0.085
QTY 29.39
AMOUNT 2.500
TOTAL : 2.500 KWD
`)
=> { amount: 2.5, date: "2026-06-21" }
*/
