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
  netWithoutIncentive: number;
  deductions: number;
  netAmount: number;
  pdfUrl?: string;
}) {
  if (input.locale === "en") {
    const lines = [
      `Salary details for ${input.employeeName}`,
      `Period: ${input.month}/${input.year}`,
      `Base salary: ${formatKWD(input.baseAmount, "en-US")}`,
      `Incentive: ${formatKWD(input.incentives, "en-US")}`,
      `Deductions: ${formatKWD(input.deductions, "en-US")}`,
      `Net salary: ${formatKWD(input.netWithoutIncentive, "en-US")} + Incentive: ${formatKWD(input.incentives, "en-US")}`,
      `Final payable: ${formatKWD(input.netAmount, "en-US")}`,
    ];

    if (input.pdfUrl) {
      lines.push(`PDF: ${input.pdfUrl}`);
    }

    return lines.join("\n");
  }

  const lines = [
    `\u062a\u0641\u0627\u0635\u064a\u0644 \u0631\u0627\u062a\u0628 ${input.employeeName}`,
    `\u0627\u0644\u0641\u062a\u0631\u0629: ${input.month}/${input.year}`,
    `\u0627\u0644\u0631\u0627\u062a\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064a: ${formatKWD(input.baseAmount, "ar-KW")}`,
    `\u0627\u0644\u062d\u0627\u0641\u0632: ${formatKWD(input.incentives, "ar-KW")}`,
    `\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a: ${formatKWD(input.deductions, "ar-KW")}`,
    `\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0627\u062a\u0628: ${formatKWD(input.netWithoutIncentive, "ar-KW")} + \u0627\u0644\u062d\u0627\u0641\u0632: ${formatKWD(input.incentives, "ar-KW")}`,
    `\u0627\u0644\u0635\u0627\u0641\u064a \u0627\u0644\u0646\u0647\u0627\u0626\u064a: ${formatKWD(input.netAmount, "ar-KW")}`,
  ];

  if (input.pdfUrl) {
    lines.push(`\u0631\u0627\u0628\u0637 \u0645\u0644\u0641 PDF: ${input.pdfUrl}`);
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
    `\u0627\u0644\u0623\u0633\u062a\u0627\u0630 / ${input.investorName}`,
    "\u0628\u0631\u062c\u0627\u0621 \u0633\u0631\u0639\u0629 \u0625\u064a\u062f\u0627\u0639 \u0645\u0628\u0627\u0644\u063a \u0627\u0644\u0631\u0648\u0627\u062a\u0628 \u0641\u064a \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643 \u0641\u064a \u0623\u0633\u0631\u0639 \u0648\u0642\u062a.",
    `\u0627\u0644\u0641\u062a\u0631\u0629: ${input.month}/${input.year}`,
    `\u0639\u062f\u062f \u0627\u0644\u0639\u0645\u0627\u0644: ${input.workersCount}`,
    `\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${formatKWD(input.amount, "ar-KW")}`,
    "\u0634\u0627\u0643\u0631\u064a\u0646 \u062a\u0639\u0627\u0648\u0646\u0643\u0645 \u0627\u0644\u062f\u0627\u0626\u0645.",
  ].join("\n");
}
