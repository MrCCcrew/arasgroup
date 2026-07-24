import { parseInvoiceText } from "@/lib/delivery/invoice-parse";

export type InvoiceOcrResult = { text: string; amount: number | null; date: string | null };

export async function readInvoiceImage(file: File): Promise<InvoiceOcrResult> {
  const module = await import("tesseract.js");
  const tesseract = module.default ?? module;
  const result = await tesseract.recognize(file, "ara+eng");
  const text = result.data.text || "";
  return { text, ...parseInvoiceText(text) };
}
