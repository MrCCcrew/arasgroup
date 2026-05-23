import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKWD(amount: number | string | null | undefined, locale = "ar-KW"): string {
  if (amount === null || amount === undefined) return locale.startsWith("ar") ? "0.000 د.ك" : "KWD 0.000";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return locale.startsWith("ar") ? "0.000 د.ك" : "KWD 0.000";
  const formatted = num.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return locale.startsWith("ar") ? `${formatted} د.ك` : `KWD ${formatted}`;
}

export function formatDate(date: Date | string | null | undefined, locale = "ar-KW"): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateShort(date: Date | string | null | undefined, locale = "ar-KW"): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function generateNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function getMonthName(month: number, locale = "ar-KW"): string {
  if (month < 1 || month > 12) return "";
  const date = new Date(Date.UTC(2026, month - 1, 1));
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(date);
}

export function getMonthNameAr(month: number): string {
  return getMonthName(month, "ar-KW");
}

export function formatMonthYear(month: number, year: number, locale = "ar-KW"): string {
  if (month < 1 || month > 12) return `${month}/${year}`;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (typeof value === "object" && "toNumber" in (value as object)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return parseFloat(String(value)) || 0;
}

export function daysUntilExpiry(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = value.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiryStatusColor(days: number | null): "red" | "yellow" | "green" | "gray" {
  if (days === null) return "gray";
  if (days < 0) return "red";
  if (days <= 30) return "red";
  if (days <= 60) return "yellow";
  return "green";
}

export function safeDecimal(value: unknown): number {
  return toNumber(value);
}

export function kuwaitNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuwait" }));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
