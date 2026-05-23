import { prisma } from "@/lib/db";
import type { IncomeStatementRow, BalanceSheetRow } from "@/lib/types";

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

/** General Ledger for an account */
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
