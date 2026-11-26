/**
 * Journal Entry Validation
 *
 * Provides precise validation for journal entries using minor units (fils)
 * to avoid floating-point precision issues.
 *
 * Kuwaiti Dinar uses 3 decimal places: 1 KWD = 1000 fils
 */

import type { JournalEntryLineInput } from "@/lib/types";

/**
 * Convert KWD amount to minor units (fils) with precision validation
 *
 * @param amount - Amount in KWD (e.g., 100.125)
 * @returns Amount in fils (e.g., 100125)
 * @throws Error if amount has more than 3 decimal places or is invalid
 */
export function toMinorUnits(amount: number): number {
  // Validate input
  if (!Number.isFinite(amount)) {
    throw new Error("المبلغ غير صالح: لا يمكن أن يكون NaN أو Infinity");
  }

  if (amount < 0) {
    throw new Error("المبلغ غير صالح: لا يمكن أن يكون سالباً");
  }

  // Check for more than 3 decimal places
  // Multiply by 1000 and check if result is integer (within floating point precision)
  const fils = amount * 1000;
  const rounded = Math.round(fils);

  // Allow tiny floating point errors (< 0.0001 fils)
  if (Math.abs(fils - rounded) > 0.0001) {
    throw new Error(`المبلغ ${amount.toFixed(6)} يحتوي على أكثر من ثلاث منازل عشرية`);
  }

  return rounded;
}

/**
 * Validate individual journal entry lines
 *
 * Rules:
 * - Each line must have EITHER debit OR credit (not both, not neither)
 * - No negative values
 * - No NaN or Infinity
 * - No more than 3 decimal places
 * - Must have valid accountId
 *
 * @param lines - Array of journal entry lines
 * @throws Error if validation fails
 */
export function validateJournalLines(lines: JournalEntryLineInput[]): void {
  // Must have at least 2 lines (debit and credit sides)
  if (!lines || lines.length < 2) {
    throw new Error("يجب أن يحتوي القيد على سطرين على الأقل (طرف مدين وطرف دائن)");
  }

  let hasDebit = false;
  let hasCredit = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Validate accountId
    if (!line.accountId || line.accountId.trim() === "") {
      throw new Error(`السطر ${lineNum}: يجب تحديد الحساب`);
    }

    // Get debit and credit values (handle null/undefined as 0)
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;

    // Validate both are numbers
    if (!Number.isFinite(debit)) {
      throw new Error(`السطر ${lineNum}: المبلغ المدين غير صالح`);
    }

    if (!Number.isFinite(credit)) {
      throw new Error(`السطر ${lineNum}: المبلغ الدائن غير صالح`);
    }

    // No negative values
    if (debit < 0) {
      throw new Error(`السطر ${lineNum}: لا يمكن أن يكون المبلغ المدين سالباً`);
    }

    if (credit < 0) {
      throw new Error(`السطر ${lineNum}: لا يمكن أن يكون المبلغ الدائن سالباً`);
    }

    // Must be EITHER debit OR credit (not both, not neither)
    if (debit > 0 && credit > 0) {
      throw new Error(`السطر ${lineNum}: لا يمكن أن يكون السطر مدينًا ودائنًا في نفس الوقت`);
    }

    if (debit === 0 && credit === 0) {
      throw new Error(`السطر ${lineNum}: يجب أن يحتوي السطر على مبلغ مدين أو دائن`);
    }

    // Validate decimal places using toMinorUnits
    try {
      if (debit > 0) {
        toMinorUnits(debit);
        hasDebit = true;
      }
      if (credit > 0) {
        toMinorUnits(credit);
        hasCredit = true;
      }
    } catch (error) {
      throw new Error(`السطر ${lineNum}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Must have at least one debit and one credit line
  if (!hasDebit) {
    throw new Error("يجب أن يحتوي القيد على طرف مدين واحد على الأقل");
  }

  if (!hasCredit) {
    throw new Error("يجب أن يحتوي القيد على طرف دائن واحد على الأقل");
  }
}

/**
 * Validate journal entry balance using precise minor units calculation
 *
 * No tolerance allowed - debit must EXACTLY equal credit down to the fils.
 *
 * @param lines - Array of journal entry lines
 * @throws Error if entry is not balanced
 */
export function validateBalance(lines: JournalEntryLineInput[]): void {
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;

  for (const line of lines) {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;

    if (debit > 0) {
      totalDebitMinor += toMinorUnits(debit);
    }

    if (credit > 0) {
      totalCreditMinor += toMinorUnits(credit);
    }
  }

  // Check for zero entry
  if (totalDebitMinor === 0 && totalCreditMinor === 0) {
    throw new Error("لا يمكن إنشاء قيد بقيمة صفرية");
  }

  // Must be EXACTLY balanced (no tolerance)
  if (totalDebitMinor !== totalCreditMinor) {
    const totalDebit = totalDebitMinor / 1000;
    const totalCredit = totalCreditMinor / 1000;
    const difference = Math.abs(totalDebit - totalCredit);

    throw new Error(
      `القيد غير متوازن: إجمالي المدين ${totalDebit.toFixed(3)} د.ك لا يساوي إجمالي الدائن ${totalCredit.toFixed(3)} د.ك (فرق ${difference.toFixed(3)} د.ك)`
    );
  }
}

/**
 * Validate complete journal entry (lines + balance)
 *
 * @param lines - Array of journal entry lines
 * @throws Error if validation fails
 */
export function validateJournalEntry(lines: JournalEntryLineInput[]): void {
  // First validate individual lines
  validateJournalLines(lines);

  // Then validate balance
  validateBalance(lines);
}
