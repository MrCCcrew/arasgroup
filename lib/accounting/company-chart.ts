import type { AccountType, CompanyType, NormalBalance, Prisma } from "@prisma/client";

type AccountTemplate = {
  code: string; nameAr: string; type: AccountType; normalBalance: NormalBalance;
  level: number; isHeader?: boolean; parentCode?: string; subtype?: string;
};

const baseAccounts: AccountTemplate[] = [
    { code: "1", nameAr: "الأصول", type: "ASSET", isHeader: true, level: 1, normalBalance: "DEBIT" },
    { code: "10", nameAr: "الأصول المتداولة", type: "ASSET", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "1" },
    { code: "1000", nameAr: "الصندوق / النقدية", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1010", nameAr: "البنك - الحساب الجاري", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1020", nameAr: "ذمم KNET", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1030", nameAr: "ذمم محافظ السائقين", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1040", nameAr: "ذمم مدينة أخرى", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1050", nameAr: "مصروفات مدفوعة مقدماً", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "11", nameAr: "الأصول الثابتة", type: "ASSET", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "1" },
    { code: "1100", nameAr: "المركبات", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "1101", nameAr: "مجمع إهلاك المركبات", type: "ASSET", level: 3, normalBalance: "CREDIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "1110", nameAr: "معدات وأجهزة", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "2", nameAr: "الالتزامات", type: "LIABILITY", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "20", nameAr: "الالتزامات المتداولة", type: "LIABILITY", isHeader: true, level: 2, normalBalance: "CREDIT", parentCode: "2" },
    { code: "2010", nameAr: "رواتب الموظفين المستحقة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2011", nameAr: "رواتب موظفي المستثمرين المستحقة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2020", nameAr: "مستحق لجهة حكومية - تجديد رخصة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2021", nameAr: "مستحق لجهة حكومية - تجديد إقامة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2022", nameAr: "مستحق إيجار", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2029", nameAr: "مستحقات أخرى للمستثمرين", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2030", nameAr: "دائنون تجاريون", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "3", nameAr: "حقوق الملكية", type: "EQUITY", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "3010", nameAr: "رأس المال", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "3020", nameAr: "أرباح مبقاة", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "3030", nameAr: "حساب جاري مالك", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "4", nameAr: "الإيرادات", type: "REVENUE", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "4010", nameAr: "إيراد خدمات التوصيل", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4011", nameAr: "إيراد طلبات", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4012", nameAr: "إيراد Ro Pops", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4020", nameAr: "إيراد غسيل السيارات", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4030", nameAr: "إيراد خدمات إدارية - مستثمرون", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4040", nameAr: "إيرادات أخرى", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "other_revenue" },
    { code: "5", nameAr: "المصروفات", type: "EXPENSE", isHeader: true, level: 1, normalBalance: "DEBIT" },
    { code: "50", nameAr: "مصروفات الموارد البشرية", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5010", nameAr: "رواتب وأجور", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5011", nameAr: "حوافز سائقين", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5050", nameAr: "تأمين عمالة وطنية", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5060", nameAr: "تجديد إقامات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5061", nameAr: "تجديد رخص مهن", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5070", nameAr: "تذاكر سفر", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "51", nameAr: "مصروفات المركبات", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5020", nameAr: "إيجار سكن سائقين", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5021", nameAr: "إيجار سيارات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5030", nameAr: "وقود", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5031", nameAr: "صيانة مركبات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5032", nameAr: "أقساط سيارات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5033", nameAr: "اشتراك نظام التتبع", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5080", nameAr: "مخالفات مرورية", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "52", nameAr: "مصروفات إدارية", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5040", nameAr: "عمولة KNET", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5041", nameAr: "هاتف واتصالات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5090", nameAr: "اشتراكات سيرفر", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "administrative_expense" },
    { code: "5091", nameAr: "إيجار جراج", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5099", nameAr: "مصروفات أخرى", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "other_expense" },
  ];

// Preserve the account codes used by automatic journal entries, while selecting
// the operational accounts for the company's activity.
export function companyChartTemplate(type: CompanyType): AccountTemplate[] {
  const deliveryOnly = new Set(["1030", "4010", "4011", "4012", "5011", "5020"]);
  const washOnly = new Set(["4020"]);
  const investorOnly = new Set(["2011", "2020", "2021", "2029", "4030"]);
  const accounts = baseAccounts.filter((account) =>
    (!deliveryOnly.has(account.code) || type === "DELIVERY") &&
    (!washOnly.has(account.code) || type === "CAR_WASH") &&
    (!investorOnly.has(account.code) || type === "DELIVERY")
  );
  const retailTypes: CompanyType[] = ["TRADING", "GENERAL_TRADING", "GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"];
  if (retailTypes.includes(type)) {
    accounts.push(
      { code: "1060", nameAr: "مخزون البضاعة", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1070", nameAr: "العملاء", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4050", nameAr: "مبيعات البضاعة", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "4051", nameAr: "مردودات ومسموحات المبيعات", type: "REVENUE", normalBalance: "DEBIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5100", nameAr: "تكلفة البضاعة المباعة", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "GROCERY") {
    accounts.push(
      { code: "1080", nameAr: "\u0639\u0647\u062f\u0629 \u0645\u0628\u064a\u0639\u0627\u062a \u0648\u0625\u064a\u062f\u0627\u0639\u0627\u062a \u0628\u0627\u0644\u0637\u0631\u064a\u0642", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1081", nameAr: "\u0641\u0631\u0648\u0642\u0627\u062a \u0627\u0644\u0635\u0646\u062f\u0648\u0642", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4052", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0622\u062c\u0644\u0629", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5101", nameAr: "\u0647\u0627\u0644\u0643 \u0648\u062a\u0627\u0644\u0641 \u0645\u062e\u0632\u0648\u0646", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5102", nameAr: "\u0641\u0631\u0648\u0642 \u0627\u0644\u062c\u0631\u062f", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "CLOTHING_RETAIL") {
    accounts.push(
      { code: "1061", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0645\u0644\u0627\u0628\u0633", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4053", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0645\u0644\u0627\u0628\u0633", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5103", nameAr: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0644\u0627\u0628\u0633 \u0627\u0644\u0645\u0628\u0627\u0639\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5107", nameAr: "\u0647\u0627\u0644\u0643 \u0648\u0639\u0631\u0636 \u0645\u0644\u0627\u0628\u0633", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "FABRIC_RETAIL") {
    accounts.push(
      { code: "1062", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0623\u0642\u0645\u0634\u0629", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4054", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0623\u0642\u0645\u0634\u0629", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5104", nameAr: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0623\u0642\u0645\u0634\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5107", nameAr: "\u0647\u0627\u0644\u0643 \u0648\u0641\u0627\u0642\u062f \u0623\u0642\u0645\u0634\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "TAILORING" || type === "TAILORING_FABRIC_RETAIL") {
    accounts.push(
      { code: "1063", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0645\u0633\u062a\u0644\u0632\u0645\u0627\u062a \u0627\u0644\u062e\u064a\u0627\u0637\u0629", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1064", nameAr: "\u0623\u0639\u0645\u0627\u0644 \u062e\u064a\u0627\u0637\u0629 \u062a\u062d\u062a \u0627\u0644\u062a\u0646\u0641\u064a\u0630", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1065", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0645\u0644\u0627\u0628\u0633 \u062c\u0627\u0647\u0632\u0629", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4055", nameAr: "\u0625\u064a\u0631\u0627\u062f \u0627\u0644\u062e\u064a\u0627\u0637\u0629 \u0648\u0627\u0644\u062a\u0641\u0635\u064a\u0644", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5105", nameAr: "\u0623\u062c\u0648\u0631 \u062e\u064a\u0627\u0637\u0629 \u0645\u0628\u0627\u0634\u0631\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5106", nameAr: "\u062a\u0643\u0627\u0644\u064a\u0641 \u062e\u064a\u0627\u0637\u0629 \u0644\u062f\u0649 \u0627\u0644\u063a\u064a\u0631", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5108", nameAr: "\u0641\u0627\u0642\u062f \u0648\u0647\u0627\u0644\u0643 \u0627\u0644\u062a\u0641\u0635\u064a\u0644", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "TAILORING_FABRIC_RETAIL") {
    accounts.push(
      { code: "1062", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0623\u0642\u0645\u0634\u0629", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4054", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0623\u0642\u0645\u0634\u0629", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5104", nameAr: "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0623\u0642\u0645\u0634\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
      { code: "5107", nameAr: "\u0647\u0627\u0644\u0643 \u0648\u0641\u0627\u0642\u062f \u0623\u0642\u0645\u0634\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "TOBACCO_SHISHA") {
    accounts.push(
      { code: "1066", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0645\u0639\u0633\u0644 \u0648\u0627\u0644\u0633\u062c\u0627\u0626\u0631 \u0648\u0627\u0644\u0634\u064a\u0634\u0629", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4056", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0645\u0639\u0633\u0644 \u0648\u0627\u0644\u0633\u062c\u0627\u0626\u0631 \u0648\u0627\u0644\u0634\u064a\u0634\u0629", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5106", nameAr: "\u062a\u0643\u0644\u0641\u0629 \u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0639\u0633\u0644 \u0648\u0627\u0644\u0633\u062c\u0627\u0626\u0631 \u0648\u0627\u0644\u0634\u064a\u0634\u0629", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "MOBILE_REPAIR_ACCESSORIES") {
    accounts.push(
      { code: "1067", nameAr: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0647\u0648\u0627\u062a\u0641 \u0648\u0627\u0644\u0625\u0643\u0633\u0633\u0648\u0627\u0631", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "4057", nameAr: "\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0647\u0648\u0627\u062a\u0641 \u0648\u0627\u0644\u0625\u0643\u0633\u0633\u0648\u0627\u0631 \u0648\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0635\u064a\u0627\u0646\u0629", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "5107", nameAr: "\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0647\u0648\u0627\u062a\u0641 \u0648\u0627\u0644\u0625\u0643\u0633\u0633\u0648\u0627\u0631", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", subtype: "operating_expense" },
    );
  }
  if (type === "CONTRACTING") {
    accounts.push(
      { code: "1200", nameAr: "عملاء المقاولات", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1210", nameAr: "تأمينات محتجزة لدى العملاء", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1220", nameAr: "دفعات مقدمة لمقاولي الباطن", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "1230", nameAr: "مخزون مواد المشروعات", type: "ASSET", normalBalance: "DEBIT", level: 3, parentCode: "10", subtype: "current_asset" },
      { code: "2040", nameAr: "مقاولو الباطن", type: "LIABILITY", normalBalance: "CREDIT", level: 3, parentCode: "20", subtype: "current_liability" },
      { code: "2050", nameAr: "دفعات مقدمة من العملاء", type: "LIABILITY", normalBalance: "CREDIT", level: 3, parentCode: "20", subtype: "current_liability" },
      { code: "2060", nameAr: "تأمينات محتجزة لمقاولي الباطن", type: "LIABILITY", normalBalance: "CREDIT", level: 3, parentCode: "20", subtype: "current_liability" },
      { code: "4060", nameAr: "إيرادات أعمال المقاولات", type: "REVENUE", normalBalance: "CREDIT", level: 2, parentCode: "4", subtype: "operating_revenue" },
      { code: "53", nameAr: "تكاليف المشروعات", type: "EXPENSE", normalBalance: "DEBIT", level: 2, parentCode: "5", isHeader: true },
      { code: "5300", nameAr: "مواد المشروعات", type: "EXPENSE", normalBalance: "DEBIT", level: 3, parentCode: "53", subtype: "operating_expense" },
      { code: "5310", nameAr: "عمالة المشروعات", type: "EXPENSE", normalBalance: "DEBIT", level: 3, parentCode: "53", subtype: "operating_expense" },
      { code: "5320", nameAr: "أعمال مقاولي الباطن", type: "EXPENSE", normalBalance: "DEBIT", level: 3, parentCode: "53", subtype: "operating_expense" },
      { code: "5330", nameAr: "معدات وإيجارات المشروعات", type: "EXPENSE", normalBalance: "DEBIT", level: 3, parentCode: "53", subtype: "operating_expense" },
      { code: "5390", nameAr: "تكاليف مشروعات أخرى", type: "EXPENSE", normalBalance: "DEBIT", level: 3, parentCode: "53", subtype: "operating_expense" },
    );
  }
  return accounts;
}

/** Call inside a transaction. Preserve existing account settings. When converting
 * to contracting, add missing activity accounts and reject incompatible codes. */
export async function initializeCompanyChart(tx: Prisma.TransactionClient, companyId: string, type: CompanyType) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
  const existing = await tx.chartOfAccount.findMany({ where: { companyId }, select: { id: true, code: true, type: true, isHeader: true } });
  const chartExtendingTypes: CompanyType[] = ["CONTRACTING", "GROCERY", "CLOTHING_RETAIL", "TAILORING", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"];
  if (existing.length && !chartExtendingTypes.includes(type)) return 0;
  const existingByCode = new Map(existing.map(a => [a.code, a]));
  const codes = new Map<string, string>();
  const template = companyChartTemplate(type);
  let createdCount = 0;
  for (const { parentCode, ...account } of template) {
    const current = existingByCode.get(account.code);
    if (current) {
      if (current.type !== account.type || current.isHeader !== (account.isHeader ?? false)) throw new Error(`الحساب ${account.code} يتعارض مع دليل المقاولات؛ راجع تصنيفه قبل تغيير النشاط`);
      codes.set(account.code, current.id);
      continue;
    }
    const parentId = parentCode ? codes.get(parentCode) : undefined;
    if (parentCode && !parentId) throw new Error(`Missing chart parent ${parentCode}`);
    const created = await tx.chartOfAccount.create({ data: { ...account, companyId, parentId }, select: { id: true } });
    codes.set(account.code, created.id);
    createdCount++;
  }
  return createdCount;
}

