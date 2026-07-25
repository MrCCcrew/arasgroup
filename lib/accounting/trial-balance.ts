/**
 * Trial Balance Calculation Logic
 *
 * Handles period opening balance, period movements, and closing balance
 * for each account in the trial balance.
 *
 * IMPORTANT: This is PRODUCTION code used by getTrialBalance.
 */

import type { AccountType } from "@prisma/client";
import type { TrialBalanceRow } from "@/lib/types";

export interface TrialBalanceAccount {
  accountId: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  type: AccountType;
  level: number;
  isHeader: boolean;
}

export interface TrialBalanceData {
  fiscalOpenings: Map<string, { debit: number; credit: number }>;
  priorMovements: Map<string, { debit: number; credit: number }>;
  periodMovements: Map<string, { debit: number; credit: number }>;
}

/**
 * Build trial balance rows from aggregated data
 *
 * @param accounts - List of accounts to include
 * @param data - Fiscal openings, prior movements, and period movements
 * @returns Trial balance rows with opening, period, and closing balances
 */
export function buildTrialBalanceRows(
  accounts: TrialBalanceAccount[],
  data: TrialBalanceData
): TrialBalanceRow[] {
  return accounts.map((account) => {
    // Fiscal year opening balance
    const opening = data.fiscalOpenings.get(account.accountId);
    const fiscalOpeningDebit = opening?.debit ?? 0;
    const fiscalOpeningCredit = opening?.credit ?? 0;

    // Prior movements (before period start)
    const prior = data.priorMovements.get(account.accountId);
    const priorDebit = prior?.debit ?? 0;
    const priorCredit = prior?.credit ?? 0;

    // Period opening balance = fiscal opening + prior movements
    const openingNet = fiscalOpeningDebit - fiscalOpeningCredit + priorDebit - priorCredit;
    const openingDebit = openingNet > 0 ? openingNet : 0;
    const openingCredit = openingNet < 0 ? Math.abs(openingNet) : 0;

    // Period movements
    const period = data.periodMovements.get(account.accountId);
    const periodDebit = period?.debit ?? 0;
    const periodCredit = period?.credit ?? 0;

    // Closing balance = opening + period movements
    const closingNet = openingNet + periodDebit - periodCredit;
    const closingDebit = closingNet > 0 ? closingNet : 0;
    const closingCredit = closingNet < 0 ? Math.abs(closingNet) : 0;

    return {
      accountId: account.accountId,
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn,
      type: account.type,
      level: account.level,
      isHeader: account.isHeader,
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      closingDebit,
      closingCredit,
    };
  });
}

/**
 * Calculate trial balance totals
 *
 * @param rows - Trial balance rows
 * @returns Totals for opening, period, and closing balances
 */
export function calculateTrialBalanceTotals(rows: TrialBalanceRow[]) {
  // Only sum non-header accounts to avoid double-counting
  const nonHeaderRows = rows.filter((r) => !r.isHeader);

  const totalOpeningDebit = nonHeaderRows.reduce((sum, r) => sum + r.openingDebit, 0);
  const totalOpeningCredit = nonHeaderRows.reduce((sum, r) => sum + r.openingCredit, 0);
  const totalPeriodDebit = nonHeaderRows.reduce((sum, r) => sum + r.periodDebit, 0);
  const totalPeriodCredit = nonHeaderRows.reduce((sum, r) => sum + r.periodCredit, 0);
  const totalClosingDebit = nonHeaderRows.reduce((sum, r) => sum + r.closingDebit, 0);
  const totalClosingCredit = nonHeaderRows.reduce((sum, r) => sum + r.closingCredit, 0);

  return {
    totalOpeningDebit,
    totalOpeningCredit,
    totalPeriodDebit,
    totalPeriodCredit,
    totalClosingDebit,
    totalClosingCredit,
  };
}
