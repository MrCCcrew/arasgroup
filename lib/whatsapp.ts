import { formatKWD } from "@/lib/utils";

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildSalaryWhatsAppMessage(input: {
  locale: "ar" | "en";
  employeeName: string;
  month: number;
  year: number;
  baseAmount: number;
  incentives: number;
  deductions: number;
  netAmount: number;
}) {
  if (input.locale === "en") {
    return [
      `Salary details for ${input.employeeName}`,
      `Period: ${input.month}/${input.year}`,
      `Base salary: ${formatKWD(input.baseAmount, "en-US")}`,
      `Incentives: ${formatKWD(input.incentives, "en-US")}`,
      `Deductions: ${formatKWD(input.deductions, "en-US")}`,
      `Net salary: ${formatKWD(input.netAmount, "en-US")}`,
    ].join("\n");
  }

  return [
    `تفاصيل راتب ${input.employeeName}`,
    `الفترة: ${input.month}/${input.year}`,
    `الراتب الأساسي: ${formatKWD(input.baseAmount)}`,
    `الحوافز: ${formatKWD(input.incentives)}`,
    `الخصومات: ${formatKWD(input.deductions)}`,
    `صافي الراتب: ${formatKWD(input.netAmount)}`,
  ].join("\n");
}
