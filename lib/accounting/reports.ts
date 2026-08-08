import { prisma } from "@/lib/db";
import type { IncomeStatementRow, BalanceSheetRow } from "@/lib/types";
import { buildAccountLedger } from "@/lib/accounting/account-ledger";

/** Income Statement (P&L) for a company in a period */
export async function getIncomeStatement(
  companyId: string,
  fiscalYearId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  revenues: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}> {
  const dateFilter = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };

  const periodLines = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        companyId,
        fiscalYearId,
        status: "POSTED",
        isDeleted: false,
        ...(startDate || endDate ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      companyId,
      type: { in: ["REVENUE", "EXPENSE"] },
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  const lineMap = new Map(periodLines.map((l) => [l.accountId, l]));

  const revenues: IncomeStatementRow[] = [];
  const expenses: IncomeStatementRow[] = [];

  for (const account of accounts) {
    const line = lineMap.get(account.id);
    const debit = Number(line?._sum?.debit ?? 0);
    const credit = Number(line?._sum?.credit ?? 0);

    // Revenue accounts have credit normal balance; net = credit - debit
    // Expense accounts have debit normal balance; net = debit - credit
    const amount = account.type === "REVENUE" ? credit - debit : debit - credit;

    if (amount === 0 && !account.isHeader) continue;

    const row: IncomeStatementRow = {
      section: account.type,
      accountId: account.id,
      code: account.code,
      nameAr: account.nameAr,
      amount,
      isHeader: account.isHeader,
    };

    if (account.type === "REVENUE") {
      revenues.push(row);
    } else {
      expenses.push(row);
    }
  }

  const totalRevenue = revenues.filter((r) => !r.isHeader).reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.filter((e) => !e.isHeader).reduce((s, e) => s + e.amount, 0);

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

/** Balance Sheet for a company */
export async function getBalanceSheet(
  companyId: string,
  fiscalYearId: string,
  asOfDate?: Date
): Promise<{
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
}> {
  const dateFilter = asOfDate ? { lte: asOfDate } : {};

  const periodLines = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        companyId,
        fiscalYearId,
        status: "POSTED",
        isDeleted: false,
        ...(asOfDate ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const openingBalances = await prisma.openingBalance.findMany({
    where: { fiscalYearId, account: { companyId } },
  });

  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      companyId,
      type: { in: ["ASSET", "LIABILITY", "EQUITY"] },
      isActive: true,
    },
    orderBy: { code: "asc" },
  });

  const lineMap = new Map(periodLines.map((l) => [l.accountId, l]));
  const openingMap = new Map(openingBalances.map((o) => [o.accountId, o]));

  const assets: BalanceSheetRow[] = [];
  const liabilities: BalanceSheetRow[] = [];
  const equity: BalanceSheetRow[] = [];

  for (const account of accounts) {
    const line = lineMap.get(account.id);
    const opening = openingMap.get(account.id);

    const openingDebit = Number(opening?.debit ?? 0);
    const openingCredit = Number(opening?.credit ?? 0);
    const periodDebit = Number(line?._sum?.debit ?? 0);
    const periodCredit = Number(line?._sum?.credit ?? 0);

    const totalDebit = openingDebit + periodDebit;
    const totalCredit = openingCredit + periodCredit;
    const net = totalDebit - totalCredit;

    // Asset: positive net = debit balance
    // Liability/Equity: positive net = credit balance (show as positive)
    const amount = account.type === "ASSET" ? net : -net;

    if (amount === 0 && !account.isHeader) continue;

    const row: BalanceSheetRow = {
      section: account.type,
      accountId: account.id,
      code: account.code,
      nameAr: account.nameAr,
      amount,
      isHeader: account.isHeader,
    };

    if (account.type === "ASSET") assets.push(row);
    else if (account.type === "LIABILITY") liabilities.push(row);
    else equity.push(row);
  }

  // Get net income from P&L
  const pnl = await getIncomeStatement(companyId, fiscalYearId, undefined, asOfDate);

  const totalAssets = assets.filter((a) => !a.isHeader).reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.filter((l) => !l.isHeader).reduce((s, l) => s + l.amount, 0);
  const totalEquity = equity.filter((e) => !e.isHeader).reduce((s, e) => s + e.amount, 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome: pnl.netIncome,
  };
}

/**
 * Cash movement for a period. Cash accounts are identified solely through the
 * existing BankAccount -> ChartOfAccount link; account names are never used.
 * The chart currently has no reliable Operating/Investing/Financing metadata,
 * so this intentionally does not guess a three-part cash-flow classification.
 */
export async function getCashMovementReport(
  companyId: string,
  fiscalYearId: string,
  startDate: Date,
  endDate: Date,
) {
  const cashAccounts = await prisma.bankAccount.findMany({
    where: { companyId, chartAccountId: { not: null } },
    select: { chartAccountId: true, chartAccount: { select: { id: true, code: true, nameAr: true, nameEn: true } } },
  });
  const accountIds = cashAccounts.flatMap((account) => account.chartAccountId ? [account.chartAccountId] : []);
  if (accountIds.length === 0) {
    return {
      accounts: [], movements: [], openingCash: 0, totalCashIn: 0, totalCashOut: 0, netCashMovement: 0, closingCash: 0,
      reconciliationDifference: 0,
      classificationAvailable: false,
      categories: { OPERATING: 0, INVESTING: 0, FINANCING: 0, NONE: 0 },
      configurationWarning: "No bank or cash accounts are linked to the chart of accounts.",
    };
  }

  const [openingBalances, prior, periodLines] = await Promise.all([
    prisma.openingBalance.findMany({ where: { fiscalYearId, accountId: { in: accountIds } } }),
    prisma.journalEntryLine.aggregate({
      where: { accountId: { in: accountIds }, journalEntry: { companyId, fiscalYearId, status: "POSTED", isDeleted: false, date: { lt: startDate } } },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalEntryLine.findMany({
      where: { accountId: { in: accountIds }, journalEntry: { companyId, fiscalYearId, status: "POSTED", isDeleted: false, date: { gte: startDate, lte: endDate } } },
      include: { account: { select: { code: true, nameAr: true, nameEn: true } }, journalEntry: { select: { id: true, number: true, date: true, descriptionAr: true, descriptionEn: true } } },
      orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  const openingFromBalances = openingBalances.reduce((sum, balance) => sum + Number(balance.debit) - Number(balance.credit), 0);
  const openingCash = openingFromBalances + Number(prior._sum.debit ?? 0) - Number(prior._sum.credit ?? 0);
  const movements = periodLines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    return {
      lineId: line.id,
      entryId: line.journalEntry.id,
      journalNumber: line.journalEntry.number,
      date: line.journalEntry.date,
      descriptionAr: line.descriptionAr ?? line.journalEntry.descriptionAr,
      descriptionEn: line.descriptionEn ?? line.journalEntry.descriptionEn,
      account: line.account,
      cashIn: debit,
      cashOut: credit,
      net: debit - credit,
    };
  });
  const totalCashIn = movements.reduce((sum, movement) => sum + movement.cashIn, 0);
  const totalCashOut = movements.reduce((sum, movement) => sum + movement.cashOut, 0);
  const netCashMovement = totalCashIn - totalCashOut;
  const closingCash = openingCash + netCashMovement;

  const entryIds = [...new Set(periodLines.map((line) => line.journalEntryId))];
  const counterparts = entryIds.length ? await prisma.journalEntryLine.findMany({
    where: { journalEntryId: { in: entryIds }, accountId: { notIn: accountIds } },
    include: { account: { select: { cashFlowCategory: true } } },
  }) : [];
  const counterpartByEntry = new Map<string, typeof counterparts>();
  for (const line of counterparts) counterpartByEntry.set(line.journalEntryId, [...(counterpartByEntry.get(line.journalEntryId) ?? []), line]);
  const categories = { OPERATING: 0, INVESTING: 0, FINANCING: 0, NONE: 0 };
  for (const movement of movements) {
    const oppositeLines = counterpartByEntry.get(movement.entryId) ?? [];
    const direction = movement.net >= 0 ? 1 : -1;
    const eligible = oppositeLines.map((line) => ({ line, amount: Math.max(0, direction > 0 ? Number(line.credit) - Number(line.debit) : Number(line.debit) - Number(line.credit)) })).filter((item) => item.amount > 0);
    const denominator = eligible.reduce((sum, item) => sum + item.amount, 0);
    if (!denominator) { categories.NONE += movement.net; continue; }
    for (const item of eligible) categories[item.line.account.cashFlowCategory] += movement.net * (item.amount / denominator);
  }

  return {
    accounts: cashAccounts.map((account) => account.chartAccount).filter((account): account is NonNullable<typeof account> => account !== null),
    movements,
    openingCash,
    totalCashIn,
    totalCashOut,
    netCashMovement,
    closingCash,
    reconciliationDifference: 0,
    classificationAvailable: true,
    categories,
    configurationWarning: null,
  };
}

/** General Ledger for an account (legacy — used by API route) */
export async function getGeneralLedger(
  companyId: string,
  accountId: string,
  startDate?: Date,
  endDate?: Date
) {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        companyId,
        status: "POSTED",
        isDeleted: false,
        ...(startDate || endDate
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: { number: true, date: true, descriptionAr: true, type: true },
      },
    },
    orderBy: [{ journalEntry: { date: "asc" } }],
  });

  let runningBalance = 0;
  return lines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    runningBalance += debit - credit;

    return {
      lineId: line.id,
      journalNumber: line.journalEntry.number,
      date: line.journalEntry.date,
      description: line.journalEntry.descriptionAr,
      type: line.journalEntry.type,
      debit,
      credit,
      balance: runningBalance,
    };
  });
}

/** Account Ledger with opening balance — for حساب الأستاذ page */
export async function getAccountLedger(
  companyId: string,
  accountId: string,
  fiscalYearId?: string,
  startDate?: Date,
  endDate?: Date
) {
  // Opening balance for the selected fiscal year
  let fiscalYearOpeningBalance = 0;
  if (fiscalYearId) {
    const ob = await prisma.openingBalance.findFirst({
      where: { fiscalYearId, accountId },
    });
    if (ob) {
      fiscalYearOpeningBalance = Number(ob.debit) - Number(ob.credit);
    }
  }

  // Get prior movements (before period start)
  let priorDebit = 0;
  let priorCredit = 0;
  if (startDate && fiscalYearId) {
    // Get all POSTED movements before the period start date
    const priorMovements = await prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          companyId,
          fiscalYearId,
          status: "POSTED",
          isDeleted: false,
          date: { lt: startDate }, // Strictly before startDate
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    priorDebit = Number(priorMovements._sum?.debit ?? 0);
    priorCredit = Number(priorMovements._sum?.credit ?? 0);
  }

  // Get period movements
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        companyId,
        status: "POSTED",
        isDeleted: false,
        ...(fiscalYearId ? { fiscalYearId } : {}),
        ...(startDate || endDate
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: { number: true, date: true, descriptionAr: true, type: true },
      },
    },
    orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }, { id: "asc" }],
  });

  // Build ledger using production logic
  return buildAccountLedger({
    fiscalYearOpeningBalance,
    priorDebit,
    priorCredit,
    periodLines: lines.map((line) => ({
      lineId: line.id,
      journalNumber: line.journalEntry.number,
      date: line.journalEntry.date,
      description: line.journalEntry.descriptionAr,
      type: line.journalEntry.type,
      debit: Number(line.debit),
      credit: Number(line.credit),
    })),
  });
}

/** Full General Ledger — all accounts with their transactions for دفتر الأستاذ العام */
export async function getFullGeneralLedger(
  companyId: string,
  fiscalYearId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        companyId,
        status: "POSTED",
        isDeleted: false,
        ...(fiscalYearId ? { fiscalYearId } : {}),
        ...(startDate || endDate
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
    },
    include: {
      account: { select: { id: true, code: true, nameAr: true, type: true } },
      journalEntry: { select: { number: true, date: true, descriptionAr: true, type: true } },
    },
    orderBy: [{ account: { code: "asc" } }, { journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }],
  });

  type AccountEntry = {
    account: { id: string; code: string; nameAr: string; type: string };
    lines: Array<{
      lineId: string;
      journalNumber: string;
      date: Date;
      description: string | null;
      type: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
  };

  const accountMap = new Map<string, AccountEntry>();

  for (const line of lines) {
    const key = line.accountId;
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        account: line.account,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
      });
    }
    const entry = accountMap.get(key)!;
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    entry.closingBalance += debit - credit;
    entry.totalDebit += debit;
    entry.totalCredit += credit;
    entry.lines.push({
      lineId: line.id,
      journalNumber: line.journalEntry.number,
      date: line.journalEntry.date,
      description: line.journalEntry.descriptionAr,
      type: line.journalEntry.type,
      debit,
      credit,
      balance: entry.closingBalance,
    });
  }

  return Array.from(accountMap.values());
}

/** Driver wallet statement */
export async function getDriverWalletStatement(
  driverId: string,
  startDate?: Date,
  endDate?: Date
) {
  const transactions = await prisma.driverWalletTransaction.findMany({
    where: {
      driverId,
      ...(startDate || endDate
        ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
        : {}),
    },
    orderBy: { date: "asc" },
  });

  let balance = 0;
  return transactions.map((tx) => {
    const amount = Number(tx.amount);
    // DEPOSIT reduces balance (driver pays us), CHARGE/DEDUCTION increases balance (driver owes more)
    if (tx.type === "DEPOSIT" || tx.type === "SETTLEMENT") {
      balance -= amount;
    } else {
      balance += amount;
    }

    return {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amount,
      balance,
      description: tx.descriptionAr,
    };
  });
}

/** Investor statement of account */
export async function getInvestorStatement(
  investorId: string,
  companyId: string,
  startDate?: Date,
  endDate?: Date
) {
  const claims = await prisma.investorClaim.findMany({
    where: {
      investorId,
      companyId,
      ...(startDate || endDate
        ? { claimDate: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
        : {}),
    },
    include: { lines: true, payments: true },
    orderBy: { claimDate: "asc" },
  });

  return claims.map((claim) => {
    const totalCollected = claim.lines.reduce((s, l) => s + Number(l.collectedAmount), 0);
    const totalActual = claim.lines.reduce((s, l) => s + Number(l.actualAmount), 0);
    const totalIncome = claim.lines.reduce((s, l) => s + Number(l.groupIncome), 0);
    const totalPaid = claim.payments.reduce((s, p) => s + Number(p.amount), 0);

    return {
      claimId: claim.id,
      type: claim.type,
      description: claim.descriptionAr,
      date: claim.claimDate,
      status: claim.status,
      totalCollected,
      totalActual,
      totalIncome,
      totalPaid,
      balance: totalCollected - totalPaid,
    };
  });
}
