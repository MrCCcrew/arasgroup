/**
 * Account Ledger Calculation Logic
 *
 * Handles period opening balance, running balance calculation,
 * and closing balance for an account ledger report.
 *
 * IMPORTANT: This is PRODUCTION code used by getAccountLedger.
 */

export interface AccountLedgerRow {
  lineId: string;
  journalNumber: string;
  date: Date;
  description: string | null;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountLedgerData {
  fiscalYearOpeningBalance: number;
  priorDebit: number;
  priorCredit: number;
  periodLines: Array<{
    lineId: string;
    journalNumber: string;
    date: Date;
    description: string | null;
    type: string;
    debit: number;
    credit: number;
  }>;
}

export interface AccountLedgerResult {
  openingBalance: number;
  rows: AccountLedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

/**
 * Build account ledger from aggregated data
 *
 * @param data - Fiscal opening, prior movements, and period lines
 * @returns Account ledger with opening, running balances, and closing
 */
export function buildAccountLedger(data: AccountLedgerData): AccountLedgerResult {
  // Calculate period opening balance = fiscal opening + prior movements
  const priorNetMovement = data.priorDebit - data.priorCredit;
  const periodOpeningBalance = data.fiscalYearOpeningBalance + priorNetMovement;

  // Calculate running balances
  let runningBalance = periodOpeningBalance;
  const rows: AccountLedgerRow[] = data.periodLines.map((line) => {
    runningBalance += line.debit - line.credit;
    return {
      lineId: line.lineId,
      journalNumber: line.journalNumber,
      date: line.date,
      description: line.description,
      type: line.type,
      debit: line.debit,
      credit: line.credit,
      balance: runningBalance,
    };
  });

  return {
    openingBalance: periodOpeningBalance,
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debit, 0),
    totalCredit: rows.reduce((s, r) => s + r.credit, 0),
    closingBalance: runningBalance,
  };
}
