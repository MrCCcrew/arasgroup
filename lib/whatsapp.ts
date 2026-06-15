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
  pdfUrl?: string;
}) {
  if (input.locale === "en") {
    const lines = [
      `Salary details for ${input.employeeName}`,
      `Period: ${input.month}/${input.year}`,
      `Base salary: ${formatKWD(input.baseAmount, "en-US")}`,
      `Incentives: ${formatKWD(input.incentives, "en-US")}`,
      `Deductions: ${formatKWD(input.deductions, "en-US")}`,
      `Net salary: ${formatKWD(input.netAmount, "en-US")}`,
    ];

    if (input.pdfUrl) {
      lines.push(`PDF: ${input.pdfUrl}`);
    }

    return lines.join("\n");
  }

  const lines = [
    `تفاصيل راتب ${input.employeeName}`,
    `الفترة: ${input.month}/${input.year}`,
    `الراتب الأساسي: ${formatKWD(input.baseAmount, "ar-KW")}`,
    `الحوافز: ${formatKWD(input.incentives, "ar-KW")}`,
    `الخصومات: ${formatKWD(input.deductions, "ar-KW")}`,
    `صافي الراتب: ${formatKWD(input.netAmount, "ar-KW")}`,
  ];

  if (input.pdfUrl) {
    lines.push(`رابط القسيمة PDF: ${input.pdfUrl}`);
  }

  return lines.join("\n");
}

export function buildInvestorSalaryFundingReminder(input: {
  locale: "ar" | "en";
  investorName: string;
  month: number;
  year: number;
  workersCount: number;
  amount: number;
  customTemplate?: string | null;
}) {
  if (input.customTemplate?.trim()) {
    return input.customTemplate
      .replaceAll("{name}", input.investorName)
      .replaceAll("{month}", String(input.month))
      .replaceAll("{year}", String(input.year))
      .replaceAll("{workersCount}", String(input.workersCount))
      .replaceAll("{amount}", formatKWD(input.amount, input.locale === "en" ? "en-US" : "ar-KW"));
  }

  if (input.locale === "en") {
    return [
      `Dear ${input.investorName},`,
      "Please deposit the salary funding amount as soon as possible.",
      `Period: ${input.month}/${input.year}`,
      `Workers count: ${input.workersCount}`,
      `Required amount: ${formatKWD(input.amount, "en-US")}`,
      "Kindly transfer the amount to the owner's account at the earliest convenience.",
    ].join("\n");
  }

  return [
    `الأستاذ / ${input.investorName}`,
    "برجاء سرعة إيداع مبالغ الرواتب في حساب المالك في أسرع وقت.",
    `الفترة: ${input.month}/${input.year}`,
    `عدد العمال: ${input.workersCount}`,
    `المبلغ المطلوب: ${formatKWD(input.amount, "ar-KW")}`,
    "شاكرين تعاونكم الدائم.",
  ].join("\n");
}
