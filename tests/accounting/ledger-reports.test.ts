/**
 * Accounting Integrity Tests - Ledger & Reports
 *
 * These regression tests ensure ledger calculation correctness.
 * DO NOT run against production database.
 *
 * Tests cover:
 * - Account ledger opening balance calculation
 * - Period balance calculation
 * - Running balance calculation
 * - Trial balance for partial periods
 * - General ledger consistency
 * - Balance display formatting
 */

import assert from "node:assert";
import { describe, test } from "node:test";

// ============================================================================
// BALANCE CALCULATION UTILITIES (to be moved to lib/accounting/balance.ts)
// ============================================================================

type Movement = {
  date: Date;
  debit: number;
  credit: number;
};

/**
 * Calculate opening balance for a period within fiscal year
 *
 * Formula:
 * Opening Balance = Fiscal Year Opening Balance + Prior Movements
 *
 * Where Prior Movements = all POSTED movements from fiscal year start to (before period start)
 */
function calculatePeriodOpeningBalance(
  fiscalYearOpening: { debit: number; credit: number },
  priorMovements: Movement[]
): number {
  const openingNet = fiscalYearOpening.debit - fiscalYearOpening.credit;

  const priorNet = priorMovements.reduce(
    (sum, m) => sum + (m.debit - m.credit),
    0
  );

  return openingNet + priorNet;
}

/**
 * Calculate running balance for movements
 */
function calculateRunningBalances(
  openingBalance: number,
  movements: Movement[]
): Array<Movement & { balance: number }> {
  let running = openingBalance;

  return movements.map((m) => {
    running += m.debit - m.credit;
    return { ...m, balance: running };
  });
}

/**
 * Format signed balance for display
 *
 * Internal: balance = debit - credit (can be negative)
 * Display:
 *   balance > 0  →  "100.000 مدين"
 *   balance < 0  →  "100.000 دائن" (absolute value)
 *   balance = 0  →  "0.000"
 */
function formatSignedBalance(
  balance: number,
  locale: "ar" | "en" = "ar"
): { amount: string; direction: string | null } {
  const absValue = Math.abs(balance);
  const formatted = absValue.toFixed(3);

  if (balance > 0) {
    return {
      amount: formatted,
      direction: locale === "ar" ? "مدين" : "Debit",
    };
  }

  if (balance < 0) {
    return {
      amount: formatted,
      direction: locale === "ar" ? "دائن" : "Credit",
    };
  }

  return {
    amount: "0.000",
    direction: null,
  };
}

/**
 * Calculate trial balance for a period
 */
type TrialBalanceAccount = {
  accountId: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

function calculateTrialBalance(
  accounts: Array<{
    accountId: string;
    fiscalYearOpening: { debit: number; credit: number };
    priorMovements: Movement[];
    periodMovements: Movement[];
  }>
): TrialBalanceAccount[] {
  return accounts.map((acc) => {
    // Opening balance for period
    const periodOpeningBalance = calculatePeriodOpeningBalance(
      acc.fiscalYearOpening,
      acc.priorMovements
    );

    const periodDebit = acc.periodMovements.reduce((sum, m) => sum + m.debit, 0);
    const periodCredit = acc.periodMovements.reduce((sum, m) => sum + m.credit, 0);

    const closingBalance = periodOpeningBalance + periodDebit - periodCredit;

    return {
      accountId: acc.accountId,
      // Opening balance split into debit/credit columns
      openingDebit: periodOpeningBalance > 0 ? periodOpeningBalance : 0,
      openingCredit: periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance) : 0,
      periodDebit,
      periodCredit,
      // Closing balance split into debit/credit columns
      closingDebit: closingBalance > 0 ? closingBalance : 0,
      closingCredit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
    };
  });
}

// ============================================================================
// TEST SUITE 5: Opening Balance Calculation
// ============================================================================

describe("Opening Balance Calculation Tests", () => {
  test("24. حساب رصيد أول الفترة في منتصف السنة", () => {
    const fiscalYearOpening = { debit: 500, credit: 0 }; // 500 debit
    const priorMovements: Movement[] = [
      { date: new Date("2026-01-15"), debit: 0, credit: 300 }, // -300
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);

    assert.strictEqual(opening, 200, "رصيد أول الفترة = 500 - 300 = 200");
  });

  test("25. رصيد أول الفترة = رصيد أول السنة عند البدء من أول السنة", () => {
    const fiscalYearOpening = { debit: 500, credit: 0 };
    const priorMovements: Movement[] = []; // no prior movements

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);

    assert.strictEqual(opening, 500, "يجب أن يساوي رصيد أول السنة");
  });

  test("26. رصيد أول الفترة مع حركات متعددة سابقة", () => {
    const fiscalYearOpening = { debit: 1000, credit: 0 }; // 1000 debit
    const priorMovements: Movement[] = [
      { date: new Date("2026-01-10"), debit: 200, credit: 0 }, // +200
      { date: new Date("2026-01-20"), debit: 0, credit: 500 }, // -500
      { date: new Date("2026-01-25"), debit: 100, credit: 0 }, // +100
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);

    // 1000 + 200 - 500 + 100 = 800
    assert.strictEqual(opening, 800, "يجب جمع جميع الحركات السابقة");
  });

  test("27. رصيد أول الفترة بافتتاحي دائن", () => {
    const fiscalYearOpening = { debit: 0, credit: 500 }; // -500 (credit)
    const priorMovements: Movement[] = [
      { date: new Date("2026-01-15"), debit: 0, credit: 200 }, // -200
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);

    // -500 - 200 = -700
    assert.strictEqual(opening, -700, "يجب التعامل مع الأرصدة الدائنة");
  });

  test("28. رصيد أول الفترة يتحول من مدين إلى دائن", () => {
    const fiscalYearOpening = { debit: 200, credit: 0 }; // 200 debit
    const priorMovements: Movement[] = [
      { date: new Date("2026-01-15"), debit: 0, credit: 500 }, // -500
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);

    // 200 - 500 = -300 (became credit)
    assert.strictEqual(opening, -300, "يجب أن يتحول الرصيد من مدين إلى دائن");
  });
});

// ============================================================================
// TEST SUITE 6: Running Balance Calculation
// ============================================================================

describe("Running Balance Calculation Tests", () => {
  test("29. حساب الرصيد الجاري بعد كل حركة", () => {
    const openingBalance = 200; // 200 debit
    const movements: Movement[] = [
      { date: new Date("2026-02-01"), debit: 100, credit: 0 },
      { date: new Date("2026-02-05"), debit: 0, credit: 50 },
      { date: new Date("2026-02-10"), debit: 0, credit: 100 },
    ];

    const withBalances = calculateRunningBalances(openingBalance, movements);

    assert.strictEqual(withBalances[0].balance, 300, "بعد الحركة الأولى: 200 + 100 = 300");
    assert.strictEqual(withBalances[1].balance, 250, "بعد الحركة الثانية: 300 - 50 = 250");
    assert.strictEqual(withBalances[2].balance, 150, "بعد الحركة الثالثة: 250 - 100 = 150");
  });

  test("30. رصيد جاري يبدأ من صفر", () => {
    const openingBalance = 0;
    const movements: Movement[] = [
      { date: new Date("2026-02-01"), debit: 500, credit: 0 },
      { date: new Date("2026-02-05"), debit: 0, credit: 200 },
    ];

    const withBalances = calculateRunningBalances(openingBalance, movements);

    assert.strictEqual(withBalances[0].balance, 500, "500");
    assert.strictEqual(withBalances[1].balance, 300, "300");
  });

  test("31. رصيد جاري بدون حركات", () => {
    const openingBalance = 150;
    const movements: Movement[] = [];

    const withBalances = calculateRunningBalances(openingBalance, movements);

    assert.strictEqual(withBalances.length, 0, "لا توجد حركات");
  });
});

// ============================================================================
// TEST SUITE 7: Balance Display Formatting
// ============================================================================

describe("Balance Display Formatting Tests", () => {
  test("32. عرض رصيد مدين موجب", () => {
    const balance = 100.000;
    const formatted = formatSignedBalance(balance, "ar");

    assert.strictEqual(formatted.amount, "100.000", "المبلغ");
    assert.strictEqual(formatted.direction, "مدين", "الاتجاه");
  });

  test("33. عرض رصيد دائن سالب", () => {
    const balance = -100.000;
    const formatted = formatSignedBalance(balance, "ar");

    assert.strictEqual(formatted.amount, "100.000", "يجب عرض القيمة المطلقة");
    assert.strictEqual(formatted.direction, "دائن", "يجب عرض دائن وليس سالب");
  });

  test("34. عرض رصيد صفر", () => {
    const balance = 0;
    const formatted = formatSignedBalance(balance, "ar");

    assert.strictEqual(formatted.amount, "0.000", "المبلغ");
    assert.strictEqual(formatted.direction, null, "بدون اتجاه");
  });

  test("35. عرض باللغة الإنجليزية", () => {
    const formatted1 = formatSignedBalance(100, "en");
    const formatted2 = formatSignedBalance(-100, "en");

    assert.strictEqual(formatted1.direction, "Debit", "Debit in English");
    assert.strictEqual(formatted2.direction, "Credit", "Credit in English");
  });

  test("36. عرض أرقام بمنازل عشرية دقيقة", () => {
    const balance = 123.456;
    const formatted = formatSignedBalance(balance, "ar");

    assert.strictEqual(formatted.amount, "123.456", "يجب الحفاظ على 3 منازل");
  });
});

// ============================================================================
// TEST SUITE 8: Trial Balance Calculation
// ============================================================================

describe("Trial Balance Calculation Tests", () => {
  test("37. ميزان مراجعة لفترة كاملة (من أول السنة)", () => {
    const accounts = [
      {
        accountId: "1001",
        fiscalYearOpening: { debit: 500, credit: 0 },
        priorMovements: [],
        periodMovements: [
          { date: new Date("2026-01-15"), debit: 200, credit: 0 },
        ],
      },
    ];

    const trialBalance = calculateTrialBalance(accounts);

    assert.strictEqual(trialBalance[0].openingDebit, 500, "رصيد أول الفترة مدين");
    assert.strictEqual(trialBalance[0].openingCredit, 0, "رصيد أول الفترة دائن");
    assert.strictEqual(trialBalance[0].periodDebit, 200, "حركة الفترة مدين");
    assert.strictEqual(trialBalance[0].periodCredit, 0, "حركة الفترة دائن");
    assert.strictEqual(trialBalance[0].closingDebit, 700, "رصيد آخر الفترة مدين");
    assert.strictEqual(trialBalance[0].closingCredit, 0, "رصيد آخر الفترة دائن");
  });

  test("38. ميزان مراجعة لفترة جزئية (من منتصف السنة)", () => {
    const accounts = [
      {
        accountId: "1001",
        fiscalYearOpening: { debit: 500, credit: 0 }, // 500
        priorMovements: [
          { date: new Date("2026-01-10"), debit: 0, credit: 300 }, // -300
        ],
        periodMovements: [
          { date: new Date("2026-02-15"), debit: 0, credit: 100 }, // -100
        ],
      },
    ];

    const trialBalance = calculateTrialBalance(accounts);

    // Opening for Feb: 500 - 300 = 200 debit
    assert.strictEqual(trialBalance[0].openingDebit, 200, "رصيد أول فبراير = 200 مدين");
    assert.strictEqual(trialBalance[0].openingCredit, 0, "");
    assert.strictEqual(trialBalance[0].periodDebit, 0, "حركة فبراير");
    assert.strictEqual(trialBalance[0].periodCredit, 100, "");
    // Closing: 200 - 100 = 100 debit
    assert.strictEqual(trialBalance[0].closingDebit, 100, "رصيد آخر فبراير = 100 مدين");
    assert.strictEqual(trialBalance[0].closingCredit, 0, "");
  });

  test("39. ميزان مراجعة - حساب يتحول من مدين إلى دائن", () => {
    const accounts = [
      {
        accountId: "2023",
        fiscalYearOpening: { debit: 0, credit: 0 }, // 0
        priorMovements: [],
        periodMovements: [
          { date: new Date("2026-02-15"), debit: 0, credit: 100 }, // -100
        ],
      },
    ];

    const trialBalance = calculateTrialBalance(accounts);

    assert.strictEqual(trialBalance[0].openingDebit, 0, "رصيد افتتاحي صفر");
    assert.strictEqual(trialBalance[0].openingCredit, 0, "");
    assert.strictEqual(trialBalance[0].closingDebit, 0, "رصيد ختامي دائن");
    assert.strictEqual(trialBalance[0].closingCredit, 100, "100 دائن");
  });

  test("40. ميزان مراجعة - توازن المجاميع", () => {
    const accounts = [
      {
        accountId: "1001",
        fiscalYearOpening: { debit: 500, credit: 0 },
        priorMovements: [],
        periodMovements: [
          { date: new Date("2026-02-01"), debit: 200, credit: 0 },
        ],
      },
      {
        accountId: "2001",
        fiscalYearOpening: { debit: 0, credit: 300 },
        priorMovements: [],
        periodMovements: [
          { date: new Date("2026-02-01"), debit: 0, credit: 200 },
        ],
      },
    ];

    const trialBalance = calculateTrialBalance(accounts);

    const totalOpeningDebit = trialBalance.reduce((sum, acc) => sum + acc.openingDebit, 0);
    const totalOpeningCredit = trialBalance.reduce((sum, acc) => sum + acc.openingCredit, 0);
    const totalPeriodDebit = trialBalance.reduce((sum, acc) => sum + acc.periodDebit, 0);
    const totalPeriodCredit = trialBalance.reduce((sum, acc) => sum + acc.periodCredit, 0);
    const totalClosingDebit = trialBalance.reduce((sum, acc) => sum + acc.closingDebit, 0);
    const totalClosingCredit = trialBalance.reduce((sum, acc) => sum + acc.closingCredit, 0);

    assert.strictEqual(totalOpeningDebit, 500, "إجمالي رصيد أول الفترة مدين");
    assert.strictEqual(totalOpeningCredit, 300, "إجمالي رصيد أول الفترة دائن");
    assert.strictEqual(totalPeriodDebit, 200, "إجمالي حركة الفترة مدين");
    assert.strictEqual(totalPeriodCredit, 200, "إجمالي حركة الفترة دائن");
    assert.strictEqual(totalClosingDebit, 700, "إجمالي رصيد آخر الفترة مدين");
    assert.strictEqual(totalClosingCredit, 500, "إجمالي رصيد آخر الفترة دائن");
  });
});

// ============================================================================
// TEST SUITE 9: Edge Cases
// ============================================================================

describe("Edge Cases Tests", () => {
  test("41. رصيد افتتاحي دائن كبير مع حركة صغيرة", () => {
    const fiscalYearOpening = { debit: 0, credit: 10000 }; // -10000
    const priorMovements: Movement[] = [];
    const periodMovements: Movement[] = [
      { date: new Date("2026-02-01"), debit: 100, credit: 0 }, // +100
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);
    const withBalances = calculateRunningBalances(opening, periodMovements);

    assert.strictEqual(opening, -10000, "رصيد افتتاحي");
    assert.strictEqual(withBalances[0].balance, -9900, "رصيد بعد الحركة");

    const formatted = formatSignedBalance(withBalances[0].balance, "ar");
    assert.strictEqual(formatted.amount, "9900.000", "القيمة المطلقة");
    assert.strictEqual(formatted.direction, "دائن", "ما زال دائنًا");
  });

  test("42. حركات في آخر يوم من الفترة يجب إدراجها", () => {
    const fiscalYearOpening = { debit: 100, credit: 0 };
    const priorMovements: Movement[] = [];
    const periodMovements: Movement[] = [
      { date: new Date("2026-02-28"), debit: 50, credit: 0 }, // last day
    ];

    const opening = calculatePeriodOpeningBalance(fiscalYearOpening, priorMovements);
    const withBalances = calculateRunningBalances(opening, periodMovements);

    assert.strictEqual(withBalances.length, 1, "يجب إدراج حركة آخر اليوم");
    assert.strictEqual(withBalances[0].balance, 150, "الرصيد يشمل حركة آخر اليوم");
  });
});

// Run message
console.log("✓ Accounting Integrity Tests - Ledger & Reports");
console.log("  Total: 19 test cases (24-42)");
console.log("  These tests validate ledger calculations, opening balances, and trial balance.");
console.log("  ⚠️  DO NOT run against production database.");
