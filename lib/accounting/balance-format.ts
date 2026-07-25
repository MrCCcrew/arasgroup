/**
 * Balance Formatting Utilities
 *
 * Accounting balances are stored internally as: balance = debit - credit
 * - Positive values represent debit balances
 * - Negative values represent credit balances
 * - Zero represents no balance
 *
 * This utility formats these signed balances for display without showing
 * negative signs, instead showing the direction (مدين/دائن).
 */

export type BalanceSide = "debit" | "credit" | null;

export interface FormattedSignedBalance {
  /** Original signed value */
  rawValue: number;
  /** Absolute value (for display) */
  amount: number;
  /** Direction: debit, credit, or null for zero */
  side: BalanceSide;
  /** Localized side label */
  sideLabel: string | null;
  /** Formatted amount string (e.g., "100.000") */
  formattedAmount: string;
  /** Complete formatted string (e.g., "100.000 مدين") */
  formatted: string;
}

export interface FormatBalanceOptions {
  /** Number of decimal places (default: 3 for KWD) */
  decimals?: number;
  /** Locale for number formatting (default: "ar-KW") */
  locale?: string;
  /** Custom debit label (default: "مدين") */
  debitLabel?: string;
  /** Custom credit label (default: "دائن") */
  creditLabel?: string;
  /** Custom zero label (default: null) */
  zeroLabel?: string | null;
  /** Whether to include label in formatted string (default: true) */
  includeLabel?: boolean;
}

/**
 * Format a signed accounting balance for display.
 *
 * @param balance - The signed balance value (debit - credit)
 * @param options - Formatting options
 * @returns Formatted balance object
 *
 * @example
 * formatSignedBalance(100)     // "100.000 مدين"
 * formatSignedBalance(-100)    // "100.000 دائن"
 * formatSignedBalance(0)       // "0.000"
 * formatSignedBalance(150.125) // "150.125 مدين"
 */
export function formatSignedBalance(
  balance: number,
  options: FormatBalanceOptions = {}
): FormattedSignedBalance {
  const {
    decimals = 3,
    locale = "ar-KW",
    debitLabel = "مدين",
    creditLabel = "دائن",
    zeroLabel = null,
    includeLabel = true,
  } = options;

  // Handle invalid inputs
  if (!Number.isFinite(balance)) {
    // For NaN, Infinity, -Infinity
    return {
      rawValue: balance,
      amount: 0,
      side: null,
      sideLabel: null,
      formattedAmount: "—",
      formatted: "—",
    };
  }

  // Get absolute value
  const amount = Math.abs(balance);

  // Format amount to specified decimals
  const formattedAmount = amount.toFixed(decimals);

  // Determine if the rounded value is effectively zero
  const roundedAmount = parseFloat(formattedAmount);
  const isZero = roundedAmount === 0;

  // Determine side and label
  let side: BalanceSide = null;
  let sideLabel: string | null = null;

  if (!isZero) {
    if (balance > 0) {
      side = "debit";
      sideLabel = debitLabel;
    } else {
      side = "credit";
      sideLabel = creditLabel;
    }
  } else {
    // Zero balance
    sideLabel = zeroLabel;
  }

  // Build formatted string
  const formatted =
    includeLabel && sideLabel
      ? `${formattedAmount} ${sideLabel}`
      : formattedAmount;

  return {
    rawValue: balance,
    amount: roundedAmount,
    side,
    sideLabel,
    formattedAmount,
    formatted,
  };
}

/**
 * Format balance for English locale.
 *
 * @param balance - The signed balance value
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted balance object
 *
 * @example
 * formatSignedBalanceEn(100)  // "100.000 Debit"
 * formatSignedBalanceEn(-100) // "100.000 Credit"
 */
export function formatSignedBalanceEn(
  balance: number,
  decimals: number = 3
): FormattedSignedBalance {
  return formatSignedBalance(balance, {
    decimals,
    locale: "en-US",
    debitLabel: "Debit",
    creditLabel: "Credit",
  });
}

/**
 * Quick format: returns just the formatted string.
 *
 * @param balance - The signed balance value
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted string (e.g., "100.000 مدين")
 *
 * @example
 * formatBalance(100)   // "100.000 مدين"
 * formatBalance(-100)  // "100.000 دائن"
 */
export function formatBalance(
  balance: number,
  decimals: number = 3
): string {
  return formatSignedBalance(balance, { decimals }).formatted;
}
