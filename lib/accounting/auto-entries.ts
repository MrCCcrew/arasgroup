import { prisma } from "@/lib/db";
import { createJournalEntry, getCurrentFiscalYear } from "./journal-engine";
import type { JournalEntry } from "@prisma/client";

/**
 * Auto journal entry generators.
 * Each function creates a specific journal entry for a business event.
 * All entries follow Kuwait double-entry accounting standards.
 */

interface AccountCodes {
  // Assets
  bank: string;
  cash: string;
  knetReceivable: string;
  driverWalletReceivable: string;
  // Revenues
  deliveryRevenue: string;
  carWashRevenue: string;
  investorServiceRevenue: string;
  // Expenses
  knetCommission: string;
  salaryExpense: string;
  // Liabilities
  employeeSalariesPayable: string;
  licenseFeePayable: string;
  residencyFeePayable: string;
}

/** Get account ID by code for a company */
async function getAccountId(companyId: string, code: string): Promise<string> {
  const account = await prisma.chartOfAccount.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (!account) {
    throw new Error(`الحساب برقم ${code} غير موجود في الشركة`);
  }
  return account.id;
}

// ─── DELIVERY MODULE ────────────────────────────────────────

/**
 * JE for receiving monthly payment from Talabat/RoPops
 *
 * DR  Bank Account              [netReceived]
 * DR  Driver Wallet Receivable  [walletDeducted]  ← company is owed from drivers
 * CR  Delivery Revenue          [grossAmount]
 */
export async function createDeliveryPaymentJE(params: {
  companyId: string;
  userId: string;
  platform: string;
  month: number;
  year: number;
  grossAmount: number;
  walletDeducted: number;
  netReceived: number;
  bankAccountId: string;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const [bankAcctId, walletReceivableId, deliveryRevenueId] = await Promise.all([
    getAccountId(params.companyId, "1010"),  // Bank
    getAccountId(params.companyId, "1030"),  // Driver Wallet Receivable
    getAccountId(params.companyId, "4010"),  // Delivery Revenue
  ]);

  const lines = [
    { accountId: bankAcctId, debit: params.netReceived, credit: 0, descriptionAr: "صافي الدفعة المستلمة" },
    ...(params.walletDeducted > 0
      ? [{ accountId: walletReceivableId, debit: params.walletDeducted, credit: 0, descriptionAr: "محفظة سائقين مخصومة من الدفعة" }]
      : []),
    { accountId: deliveryRevenueId, debit: 0, credit: params.grossAmount, descriptionAr: "إيراد توصيل" },
  ];

  return createJournalEntry({
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

/**
 * JE for driver wallet deposit (driver pays company to settle wallet)
 *
 * DR  Cash / Bank               [amount]
 * CR  Driver Wallet Receivable  [amount]  ← reduces what driver owes
 */
export async function createDriverWalletDepositJE(params: {
  companyId: string;
  userId: string;
  driverId: string;
  amount: number;
  isBankDeposit: boolean;
  refId: string;
  descriptionAr: string;
}): Promise<JournalEntry> {
  const fiscalYearId = await getCurrentFiscalYear(params.companyId);

  const cashOrBankCode = params.isBankDeposit ? "1010" : "1000"; // Bank or Cash
  const [cashBankId, walletReceivableId] = await Promise.all([
    getAccountId(params.companyId, cashOrBankCode),
    getAccountId(params.companyId, "1030"),
  ]);

  return createJournalEntry({
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

// ─── CAR WASH MODULE ─────────────────────────────────────────

/**
 * JE for car wash daily operations
 *
 * DR  Cash              [cashAmount]
 * DR  KNET Receivable   [knetAmount]
 * CR  Car Wash Revenue  [totalRevenue]
 */
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
    getAccountId(params.companyId, "1000"),  // Cash
    getAccountId(params.companyId, "1020"),  // KNET Receivable
    getAccountId(params.companyId, "4020"),  // Car Wash Revenue
  ]);

  const lines = [];
  if (params.cashAmount > 0) {
    lines.push({ accountId: cashId, debit: params.cashAmount, credit: 0, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });
  }
  if (params.knetAmount > 0) {
    lines.push({ accountId: knetReceivableId, debit: params.knetAmount, credit: 0, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });
  }
  lines.push({ accountId: revenueId, debit: 0, credit: totalRevenue, carWashVehicleId: params.vehicleId, costCenterId: params.costCenterId });

  return createJournalEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: params.date,
    descriptionAr: `إيراد غسيل سيارات يومي`,
    type: "CAR_WASH_REVENUE",
    refModule: "car_wash",
    refId: params.refId,
    isAutomatic: true,
    costCenterId: params.costCenterId,
    lines,
    createdById: params.userId,
  });
}

/**
 * JE for KNET settlement (next-day bank deposit minus commission)
 *
 * DR  Bank Account          [netAmount]
 * DR  KNET Commission       [commission]
 * CR  KNET Receivable       [grossAmount]
 */
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
    getAccountId(params.companyId, "1010"),  // Bank
    getAccountId(params.companyId, "5040"),  // KNET Commission Expense
    getAccountId(params.companyId, "1020"),  // KNET Receivable
  ]);

  return createJournalEntry({
    companyId: params.companyId,
    fiscalYearId,
    date: params.date,
    descriptionAr: `تسوية مدفوعات KNET`,
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

// ─── INVESTORS MODULE ────────────────────────────────────────

/**
 * JE for investor fee collection (license, residency, rent, etc.)
 *
 * DR  Cash / Bank           [collectedAmount]
 * CR  Fee Payable           [actualAmount]
 * CR  Group Service Revenue [groupIncome / margin]
 */
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

  // Pick payable account based on claim type
  const payableCode = params.claimType === "LICENSE_RENEWAL" ? "2020"
    : params.claimType === "RESIDENCY_RENEWAL" ? "2021"
    : params.claimType === "RENT" ? "2022"
    : "2029"; // Other payable

  const [cashId, payableId, serviceRevenueId] = await Promise.all([
    getAccountId(params.companyId, "1000"),  // Cash
    getAccountId(params.companyId, payableCode),
    getAccountId(params.companyId, "4030"),  // Group Service Revenue
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

  return createJournalEntry({
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

/**
 * JE for investor salary collection (LIABILITY — not revenue)
 *
 * DR  Bank Account              [collectedAmount]
 * CR  Employee Salaries Payable [collectedAmount]
 */
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
    getAccountId(params.companyId, "1010"),  // Bank
    getAccountId(params.companyId, "2010"),  // Employee Salaries Payable
  ]);

  return createJournalEntry({
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

/**
 * JE for disbursing salaries funded by investor
 *
 * DR  Employee Salaries Payable [amount]
 * CR  Bank Account              [amount]
 */
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

  return createJournalEntry({
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

// ─── HR / SALARIES ───────────────────────────────────────────

/**
 * JE for company salary payment (own employees)
 *
 * DR  Salary Expense  [amount]
 * CR  Bank Account    [amount]
 */
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
    getAccountId(params.companyId, "5010"),  // Salary Expense
  ]);

  return createJournalEntry({
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

// ─── EXPENSES ────────────────────────────────────────────────

/**
 * JE for general expense
 *
 * DR  Expense Account  [amount]
 * CR  Cash / Bank      [amount]
 */
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

  return createJournalEntry({
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
