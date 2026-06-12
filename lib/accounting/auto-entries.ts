import type { JournalEntry } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createJournalEntry, getCurrentFiscalYear, postJournalEntry } from "./journal-engine";

async function getAccountId(companyId: string, code: string): Promise<string> {
  const account = await prisma.chartOfAccount.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (!account) {
    throw new Error(`الحساب برقم ${code} غير موجود في الشركة`);
  }
  return account.id;
}

async function createAutomaticEntry(args: Parameters<typeof createJournalEntry>[0]): Promise<JournalEntry> {
  return createJournalEntry(args);
}

// ينشئ القيد ويرحّله فورًا (POSTED) — للقيود التلقائية اللي لازم تظهر في الأرصدة
// مباشرةً (التقارير بتقرأ POSTED فقط). يُستخدم لتدفّق محافظ السائقين (إيداع/تحصيل).
async function createAndPostAutomaticEntry(args: Parameters<typeof createJournalEntry>[0]): Promise<JournalEntry> {
  const entry = await createJournalEntry(args);
  return postJournalEntry(entry.id, args.createdById ?? "");
}

export async function createDeliveryPaymentJE(params: {
  companyId: string;
  userId: string;
  platform: string;
  month: number;
  year: number;
  grossAmount: number;
  walletDeducted: number;
  netReceived: number;
  bankAccountId?: string;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const bankAccount = params.bankAccountId
    ? await prisma.bankAccount.findFirst({
        where: { id: params.bankAccountId, companyId: params.companyId, isActive: true },
        include: { chartAccount: true },
      })
    : null;

  const [walletReceivableId, deliveryRevenueId] = await Promise.all([
    getAccountId(params.companyId, "1030"),
    getAccountId(params.companyId, "4010"),
  ]);

  const bankAccountId = bankAccount?.chartAccountId ?? (await getAccountId(params.companyId, "1010"));

  const lines = [
    { accountId: bankAccountId, debit: params.netReceived, credit: 0, descriptionAr: "صافي الدفعة المستلمة" },
    ...(params.walletDeducted > 0
      ? [{ accountId: walletReceivableId, debit: params.walletDeducted, credit: 0, descriptionAr: "محفظة سائقين مخصومة من الدفعة" }]
      : []),
    { accountId: deliveryRevenueId, debit: 0, credit: params.grossAmount, descriptionAr: "إيراد توصيل" },
  ];

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "DELIVERY_INCOME",
    refModule: "delivery",
    refId: params.refId,
    isAutomatic: true,
    lines,
    createdById: params.userId,
  });
}

export async function createDriverWalletDepositJE(params: {
  companyId: string;
  userId: string;
  driverId: string;
  amount: number;
  isBankDeposit: boolean;
  refId: string;
  descriptionAr: string;
  bankAccountId?: string | null;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  // الإيداع يقفل ذمم محافظ السائقين (1030): الكاش وصل للبنك والسائق سدّد ما عليه.
  // (الالتزام لطلبات يُسجَّل عند التحصيل عبر قيد التحصيل Dr 1030 / Cr 2031 — النموذج ب.)
  const walletReceivableId = await getAccountId(params.companyId, "1030");
  let cashBankId: string;
  if (params.isBankDeposit && params.bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: params.bankAccountId, companyId: params.companyId, isActive: true },
      select: { chartAccountId: true },
    });
    cashBankId = bank?.chartAccountId ?? (await getAccountId(params.companyId, "1010"));
  } else {
    cashBankId = await getAccountId(params.companyId, params.isBankDeposit ? "1010" : "1000");
  }

  return createAndPostAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "DELIVERY_WALLET",
    refModule: "delivery",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: cashBankId, debit: params.amount, credit: 0, driverId: params.driverId },
      { accountId: walletReceivableId, debit: 0, credit: params.amount, driverId: params.driverId },
    ],
    createdById: params.userId,
  });
}

/**
 * قيد التحصيل (COD) — النموذج (ب): عند تسجيل تحصيل للسائق، يُسجَّل التزام لشركة طلبات:
 *   مدين  1030 ذمم محافظ السائقين (السائق ماسك فلوس لطلبات)
 *     دائن  2031 أمانات لشركة طلبات (إحنا مديونين لطلبات)
 * يُرحَّل فورًا. يتطلّب وجود حساب 2031 (التزامات). لو مش موجود، يرجّع null (لا يُسجَّل قيد).
 */
export async function createDriverWalletChargeJE(params: {
  companyId: string;
  userId: string;
  driverId: string;
  amount: number;
  date: Date;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry | null> {
  const custody = await prisma.chartOfAccount.findFirst({
    where: { companyId: params.companyId, code: "2031", type: "LIABILITY", isActive: true },
    select: { id: true },
  });
  if (!custody) return null;

  const fiscalYearId = await getCurrentFiscalYear(params.companyId);
  const walletReceivableId = await getAccountId(params.companyId, "1030");

  return createAndPostAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: params.date,
    descriptionAr: params.descriptionAr,
    type: "DELIVERY_WALLET",
    refModule: "delivery_charge",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: walletReceivableId, debit: params.amount, credit: 0, driverId: params.driverId },
      { accountId: custody.id, debit: 0, credit: params.amount, driverId: params.driverId },
    ],
    createdById: params.userId,
  });
}

export async function createCarWashDailyJE(params: {
  companyId: string;
  userId: string;
  vehicleId: string;
  costCenterId?: string;
  cashAmount: number;
  knetAmount: number;
  date: Date;
  refId: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);
  const totalRevenue = params.cashAmount + params.knetAmount;

  const [cashId, knetReceivableId, revenueId] = await Promise.all([
    getAccountId(params.companyId, "1000"),
    getAccountId(params.companyId, "1020"),
    getAccountId(params.companyId, "4020"),
  ]);

  const lines = [];
  if (params.cashAmount > 0) {
    lines.push({ accountId: cashId, debit: params.cashAmount, credit: 0, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });
  }
  if (params.knetAmount > 0) {
    lines.push({ accountId: knetReceivableId, debit: params.knetAmount, credit: 0, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });
  }
  lines.push({ accountId: revenueId, debit: 0, credit: totalRevenue, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: params.date,
    descriptionAr: "إيراد غسيل سيارات يومي",
    type: "CAR_WASH_REVENUE",
    refModule: "car_wash",
    refId: params.refId,
    isAutomatic: true,
    costCenterId: params.costCenterId,
    lines,
    createdById: params.userId,
  });
}

export async function createKnetSettlementJE(params: {
  companyId: string;
  userId: string;
  grossAmount: number;
  commission: number;
  netAmount: number;
  refId: string;
  date: Date;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const [bankId, commissionId, knetReceivableId] = await Promise.all([
    getAccountId(params.companyId, "1010"),
    getAccountId(params.companyId, "5040"),
    getAccountId(params.companyId, "1020"),
  ]);

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: params.date,
    descriptionAr: "تسوية مدفوعات KNET",
    type: "KNET_SETTLEMENT",
    refModule: "car_wash",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: bankId, debit: params.netAmount, credit: 0 },
      { accountId: commissionId, debit: params.commission, credit: 0 },
      { accountId: knetReceivableId, debit: 0, credit: params.grossAmount },
    ],
    createdById: params.userId,
  });
}

export async function createInvestorClaimCollectionJE(params: {
  companyId: string;
  userId: string;
  investorId: string;
  claimType: string;
  collectedAmount: number;
  actualAmount: number;
  groupIncome: number;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const payableCode =
    params.claimType === "LICENSE_RENEWAL"
      ? "2020"
      : params.claimType === "RESIDENCY_RENEWAL"
      ? "2021"
      : params.claimType === "RENT"
      ? "2022"
      : "2029";

  const [cashId, payableId, serviceRevenueId] = await Promise.all([
    getAccountId(params.companyId, "1000"),
    getAccountId(params.companyId, payableCode),
    getAccountId(params.companyId, "4030"),
  ]);

  const lines: { accountId: string; debit: number; credit: number; investorId?: string; descriptionAr?: string }[] = [
    { accountId: cashId, debit: params.collectedAmount, credit: 0, investorId: params.investorId },
  ];

  if (params.actualAmount > 0) {
    lines.push({ accountId: payableId, debit: 0, credit: params.actualAmount, descriptionAr: "مبلغ الرسوم الفعلية" });
  }

  if (params.groupIncome > 0) {
    lines.push({ accountId: serviceRevenueId, debit: 0, credit: params.groupIncome, descriptionAr: "هامش ربح المجموعة" });
  }

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "INVESTOR_COLLECTION",
    refModule: "investors",
    refId: params.refId,
    isAutomatic: true,
    lines,
    createdById: params.userId,
  });
}

export async function createInvestorSalaryCollectionJE(params: {
  companyId: string;
  userId: string;
  investorId: string;
  amount: number;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const [bankId, salariesPayableId] = await Promise.all([
    getAccountId(params.companyId, "1010"),
    getAccountId(params.companyId, "2010"),
  ]);

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "INVESTOR_SALARY_COLLECTION",
    refModule: "investors",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: bankId, debit: params.amount, credit: 0, investorId: params.investorId },
      { accountId: salariesPayableId, debit: 0, credit: params.amount, investorId: params.investorId },
    ],
    createdById: params.userId,
  });
}

export async function createInvestorSalaryDisbursementJE(params: {
  companyId: string;
  userId: string;
  amount: number;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const [bankId, salariesPayableId] = await Promise.all([
    getAccountId(params.companyId, "1010"),
    getAccountId(params.companyId, "2010"),
  ]);

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "INVESTOR_SALARY_DISBURSEMENT",
    refModule: "investors",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: salariesPayableId, debit: params.amount, credit: 0 },
      { accountId: bankId, debit: 0, credit: params.amount },
    ],
    createdById: params.userId,
  });
}

export async function createSalaryPaymentJE(params: {
  companyId: string;
  userId: string;
  totalAmount: number;
  month: number;
  year: number;
  refId: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const [bankId, salaryExpenseId] = await Promise.all([
    getAccountId(params.companyId, "1010"),
    getAccountId(params.companyId, "5010"),
  ]);

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: `رواتب شهر ${params.month}/${params.year}`,
    type: "SALARY",
    refModule: "hr",
    refId: params.refId,
    isAutomatic: true,
    lines: [
      { accountId: salaryExpenseId, debit: params.totalAmount, credit: 0 },
      { accountId: bankId, debit: 0, credit: params.totalAmount },
    ],
    createdById: params.userId,
  });
}

export async function createExpenseJE(params: {
  companyId: string;
  userId: string;
  expenseAccountCode: string;
  amount: number;
  isCash: boolean;
  costCenterId?: string;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);
  const cashBankCode = params.isCash ? "1000" : "1010";

  const [cashBankId, expenseId] = await Promise.all([
    getAccountId(params.companyId, cashBankCode),
    getAccountId(params.companyId, params.expenseAccountCode),
  ]);

  return createAutomaticEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: new Date(),
    descriptionAr: params.descriptionAr,
    type: "EXPENSE",
    refModule: "expenses",
    refId: params.refId,
    isAutomatic: true,
    costCenterId: params.costCenterId,
    lines: [
      { accountId: expenseId, debit: params.amount, credit: 0, costCenterId: params.costCenterId },
      { accountId: cashBankId, debit: 0, credit: params.amount },
    ],
    createdById: params.userId,
  });
}
