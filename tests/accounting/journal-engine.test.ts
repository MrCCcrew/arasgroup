/**
 * Accounting Integrity Tests - Journal Engine
 *
 * These regression tests ensure accounting logic correctness.
 * DO NOT run against production database.
 *
 * Tests cover:
 * - Balance validation and precision
 * - Journal entry creation and validation
 * - Line validation (debit/credit rules)
 * - Fiscal year validation
 * - Date validation
 * - Account validation
 */

import assert from "node:assert";
import { describe, test, before } from "node:test";

// Mock types for testing (will be replaced with actual imports when connected to test DB)
type JournalEntryLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  descriptionAr?: string;
  costCenterId?: string;
  driverId?: string;
  employeeId?: string;
};

type CreateJournalEntryInput = {
  companyId: string;
  fiscalYearId?: string;
  date: Date;
  descriptionAr: string;
  descriptionEn?: string;
  type: string;
  lines: JournalEntryLineInput[];
  reference?: string;
  refModule?: string;
  refId?: string;
  isAutomatic?: boolean;
  costCenterId?: string;
  createdById?: string;
};

// ============================================================================
// VALIDATION UTILITIES (to be moved to lib/accounting/validation.ts)
// ============================================================================

/**
 * Validates journal entry balance using integer arithmetic (fils)
 * 1 KWD = 1000 fils, so we multiply by 1000 and compare integers
 */
function validateBalancePrecise(lines: JournalEntryLineInput[]): void {
  // Convert to fils (integer arithmetic)
  const totalDebitFils = lines.reduce((sum, line) => sum + Math.round(line.debit * 1000), 0);
  const totalCreditFils = lines.reduce((sum, line) => sum + Math.round(line.credit * 1000), 0);

  if (totalDebitFils !== totalCreditFils) {
    const debitKWD = (totalDebitFils / 1000).toFixed(3);
    const creditKWD = (totalCreditFils / 1000).toFixed(3);
    throw new Error(
      `القيد غير متوازن: إجمالي المدين ${debitKWD} لا يساوي إجمالي الدائن ${creditKWD}`
    );
  }

  if (totalDebitFils === 0) {
    throw new Error("القيد لا يحتوي على أي حركة (الإجمالي صفر)");
  }
}

/**
 * Validates individual journal entry lines
 */
function validateJournalLines(lines: JournalEntryLineInput[]): void {
  if (!lines || lines.length === 0) {
    throw new Error("القيد يجب أن يحتوي على سطر واحد على الأقل");
  }

  let hasDebit = false;
  let hasCredit = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check both debit and credit not set simultaneously
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(`السطر ${lineNum}: لا يمكن أن يحتوي السطر على مدين ودائن معاً`);
    }

    // Check at least one is set
    if (line.debit === 0 && line.credit === 0) {
      throw new Error(`السطر ${lineNum}: يجب أن يحتوي السطر على مدين أو دائن`);
    }

    // Check no negative values
    if (line.debit < 0) {
      throw new Error(`السطر ${lineNum}: المبلغ المدين لا يمكن أن يكون سالباً`);
    }
    if (line.credit < 0) {
      throw new Error(`السطر ${lineNum}: المبلغ الدائن لا يمكن أن يكون سالباً`);
    }

    // Check for NaN or Infinity
    if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit)) {
      throw new Error(`السطر ${lineNum}: المبلغ غير صالح`);
    }

    // Check precision (max 3 decimal places)
    const debitStr = line.debit.toFixed(3);
    const creditStr = line.credit.toFixed(3);
    if (Math.abs(line.debit - parseFloat(debitStr)) > 0.0001) {
      throw new Error(`السطر ${lineNum}: المبلغ المدين يحتوي على أكثر من 3 منازل عشرية`);
    }
    if (Math.abs(line.credit - parseFloat(creditStr)) > 0.0001) {
      throw new Error(`السطر ${lineNum}: المبلغ الدائن يحتوي على أكثر من 3 منازل عشرية`);
    }

    if (line.debit > 0) hasDebit = true;
    if (line.credit > 0) hasCredit = true;
  }

  // Check entry has at least one debit and one credit
  if (!hasDebit) {
    throw new Error("القيد يجب أن يحتوي على سطر مدين واحد على الأقل");
  }
  if (!hasCredit) {
    throw new Error("القيد يجب أن يحتوي على سطر دائن واحد على الأقل");
  }
}

/**
 * Validates that date falls within fiscal year
 */
function validateDateInFiscalYear(
  date: Date,
  fiscalYear: { startDate: Date; endDate: Date; year: number }
): void {
  if (date < fiscalYear.startDate || date > fiscalYear.endDate) {
    throw new Error(
      `تاريخ القيد ${date.toISOString().split('T')[0]} خارج نطاق السنة المالية ${fiscalYear.year} (${fiscalYear.startDate.toISOString().split('T')[0]} إلى ${fiscalYear.endDate.toISOString().split('T')[0]})`
    );
  }
}

// ============================================================================
// TEST SUITE 1: Balance Validation
// ============================================================================

describe("Balance Validation Tests", () => {
  test("1. رفض قيد غير متوازن", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 200, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 100 }, // unbalanced
    ];

    assert.throws(
      () => validateBalancePrecise(lines),
      /القيد غير متوازن/,
      "يجب رفض قيد غير متوازن"
    );
  });

  test("2. قبول قيد متوازن", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 200, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 200 },
    ];

    assert.doesNotThrow(
      () => validateBalancePrecise(lines),
      "يجب قبول قيد متوازن"
    );
  });

  test("3. رفض قيد إجماليه صفر", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 0, credit: 0 },
    ];

    assert.throws(
      () => validateBalancePrecise(lines),
      /لا يحتوي على أي حركة/,
      "يجب رفض قيد بدون حركة"
    );
  });

  test("4. رفض فرق 0.001 د.ك (1 فلس)", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 200.000, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 199.999 }, // 1 fils difference
    ];

    assert.throws(
      () => validateBalancePrecise(lines),
      /القيد غير متوازن/,
      "يجب رفض فرق حتى لو 1 فلس"
    );
  });

  test("5. قبول قيد معقد متوازن (3 سطور)", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 200.125, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 100.500 },
      { accountId: "acc3", debit: 0, credit: 99.625 },
    ];

    assert.doesNotThrow(
      () => validateBalancePrecise(lines),
      "يجب قبول قيد معقد متوازن"
    );
  });
});

// ============================================================================
// TEST SUITE 2: Line Validation
// ============================================================================

describe("Line Validation Tests", () => {
  test("6. رفض سطر يحتوي مدين ودائن معاً", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 100, credit: 50 }, // invalid
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /لا يمكن أن يحتوي السطر على مدين ودائن معاً/,
      "يجب رفض سطر بمدين ودائن"
    );
  });

  test("7. رفض سطر صفري (debit=0, credit=0)", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 0, credit: 0 },
      { accountId: "acc2", debit: 100, credit: 0 },
      { accountId: "acc3", debit: 0, credit: 100 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /يجب أن يحتوي السطر على مدين أو دائن/,
      "يجب رفض سطر صفري"
    );
  });

  test("8. رفض مبلغ مدين سالب", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: -100, credit: 0 }, // negative
      { accountId: "acc2", debit: 0, credit: 100 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /المبلغ المدين لا يمكن أن يكون سالباً/,
      "يجب رفض مبلغ مدين سالب"
    );
  });

  test("9. رفض مبلغ دائن سالب", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 100, credit: 0 },
      { accountId: "acc2", debit: 0, credit: -100 }, // negative
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /المبلغ الدائن لا يمكن أن يكون سالباً/,
      "يجب رفض مبلغ دائن سالب"
    );
  });

  test("10. رفض قيد بدون سطور", () => {
    const lines: JournalEntryLineInput[] = [];

    assert.throws(
      () => validateJournalLines(lines),
      /يجب أن يحتوي على سطر واحد على الأقل/,
      "يجب رفض قيد فارغ"
    );
  });

  test("11. رفض قيد بسطر مدين فقط (بدون دائن)", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 100, credit: 0 },
      { accountId: "acc2", debit: 50, credit: 0 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /يجب أن يحتوي على سطر دائن واحد على الأقل/,
      "يجب رفض قيد بدون دائن"
    );
  });

  test("12. رفض قيد بسطر دائن فقط (بدون مدين)", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 0, credit: 100 },
      { accountId: "acc2", debit: 0, credit: 50 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /يجب أن يحتوي على سطر مدين واحد على الأقل/,
      "يجب رفض قيد بدون مدين"
    );
  });

  test("13. رفض NaN في المبلغ", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: NaN, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 100 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /المبلغ غير صالح/,
      "يجب رفض NaN"
    );
  });

  test("14. رفض Infinity في المبلغ", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: Infinity, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 100 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /المبلغ غير صالح/,
      "يجب رفض Infinity"
    );
  });

  test("15. رفض أكثر من 3 منازل عشرية", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 100.1234, credit: 0 }, // 4 decimals
      { accountId: "acc2", debit: 0, credit: 100.123 },
    ];

    assert.throws(
      () => validateJournalLines(lines),
      /يحتوي على أكثر من 3 منازل عشرية/,
      "يجب رفض أكثر من 3 منازل"
    );
  });

  test("16. قبول 3 منازل عشرية بالضبط", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "acc1", debit: 100.125, credit: 0 },
      { accountId: "acc2", debit: 0, credit: 100.125 },
    ];

    assert.doesNotThrow(() => {
      validateJournalLines(lines);
      validateBalancePrecise(lines);
    }, "يجب قبول 3 منازل عشرية");
  });
});

// ============================================================================
// TEST SUITE 3: Fiscal Year and Date Validation
// ============================================================================

describe("Fiscal Year and Date Validation Tests", () => {
  const fiscalYear2026 = {
    year: 2026,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  };

  test("17. رفض تاريخ قبل بداية السنة المالية", () => {
    const date = new Date("2025-12-31");

    assert.throws(
      () => validateDateInFiscalYear(date, fiscalYear2026),
      /خارج نطاق السنة المالية/,
      "يجب رفض تاريخ قبل السنة"
    );
  });

  test("18. رفض تاريخ بعد نهاية السنة المالية", () => {
    const date = new Date("2027-01-01");

    assert.throws(
      () => validateDateInFiscalYear(date, fiscalYear2026),
      /خارج نطاق السنة المالية/,
      "يجب رفض تاريخ بعد السنة"
    );
  });

  test("19. قبول تاريخ في أول يوم من السنة", () => {
    const date = new Date("2026-01-01");

    assert.doesNotThrow(
      () => validateDateInFiscalYear(date, fiscalYear2026),
      "يجب قبول أول يوم"
    );
  });

  test("20. قبول تاريخ في آخر يوم من السنة", () => {
    const date = new Date("2026-12-31");

    assert.doesNotThrow(
      () => validateDateInFiscalYear(date, fiscalYear2026),
      "يجب قبول آخر يوم"
    );
  });

  test("21. قبول تاريخ في منتصف السنة", () => {
    const date = new Date("2026-07-15");

    assert.doesNotThrow(
      () => validateDateInFiscalYear(date, fiscalYear2026),
      "يجب قبول تاريخ منتصف السنة"
    );
  });
});

// ============================================================================
// TEST SUITE 4: Integration - Complete Entry Validation
// ============================================================================

describe("Complete Entry Validation Tests", () => {
  test("22. قبول قيد كامل صحيح", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "5091", debit: 200.000, credit: 0, descriptionAr: "إيجار جراج" },
      { accountId: "2023", debit: 0, credit: 100.000, descriptionAr: "مستحق إيجار كراج" },
      { accountId: "10102", debit: 0, credit: 100.000, descriptionAr: "حساب البنك المنفصل" },
    ];

    assert.doesNotThrow(() => {
      validateJournalLines(lines);
      validateBalancePrecise(lines);
    }, "يجب قبول قيد كامل صحيح");

    // Verify totals
    const debitTotal = lines.reduce((sum, l) => sum + l.debit, 0);
    const creditTotal = lines.reduce((sum, l) => sum + l.credit, 0);
    assert.strictEqual(debitTotal, 200.000, "إجمالي المدين يجب أن يكون 200.000");
    assert.strictEqual(creditTotal, 200.000, "إجمالي الدائن يجب أن يكون 200.000");
  });

  test("23. رفض قيد معقد غير متوازن", () => {
    const lines: JournalEntryLineInput[] = [
      { accountId: "5091", debit: 200.000, credit: 0 },
      { accountId: "2023", debit: 0, credit: 100.000 },
      { accountId: "10102", debit: 0, credit: 99.999 }, // off by 0.001
    ];

    assert.throws(
      () => validateBalancePrecise(lines),
      /القيد غير متوازن/,
      "يجب رفض قيد معقد غير متوازن"
    );
  });
});

// Run message
console.log("✓ Accounting Integrity Tests - Journal Engine");
console.log("  Total: 23 test cases");
console.log("  These tests validate journal entry creation, balance precision, and line validation.");
console.log("  ⚠️  DO NOT run against production database.");
