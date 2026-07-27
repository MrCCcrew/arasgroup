import { parseInvoiceText } from "@/lib/delivery/invoice-parse";

export type InvoiceOcrResult = {
  text: string;
  amount: number | null;
  date: string | null;
  currency: "KWD" | null;
  merchantName: string | null;
  confidence: number;
};

function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function extractMerchantName(text: string): string | null {
  const line = text.split(/\r?\n/).map((value) => value.trim()).find((value) => {
    const normalized = normalizeDigits(value).toLowerCase();
    return value.length >= 3 && /[a-z\u0621-\u064a]/i.test(value) && !/(invoice|receipt|date|total|amount|فاتورة|إجمالي|التاريخ)/i.test(normalized);
  });
  return line ? line.slice(0, 120) : null;
}

export async function readInvoiceImage(file: File): Promise<InvoiceOcrResult> {
  const module = await import("tesseract.js");
  const tesseract = module.default ?? module;
  const result = await tesseract.recognize(file, "ara+eng");
  const text = result.data.text || "";
  const normalized = normalizeDigits(text).toLowerCase();
  const parsed = parseInvoiceText(text);
  return {
    text,
    ...parsed,
    currency: /\bkwd\b|\bk\.?d\.?\b|د\s*\.?\s*ك|دينار\s+كويتي/i.test(normalized) ? "KWD" : null,
    merchantName: extractMerchantName(text),
    confidence: Number(result.data.confidence || 0),
  };
}
