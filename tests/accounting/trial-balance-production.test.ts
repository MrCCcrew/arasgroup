/**
 * Production Code Tests: getTrialBalance
 *
 * These tests verify the ACTUAL production function buildTrialBalanceRows
 * used by getTrialBalance.
 *
 * Test Coverage:
 * - Period opening balance = fiscal opening + prior movements
 * - Period movements (debit/credit shown separately, no netting)
 * - Closing balance = opening + period debit - period credit
 * - Negative balances converted to credit column
 * - Trial balance totals validation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTrialBalanceRows,
  calculateTrialBalanceTotals,
  type TrialBalanceAccount,
  type TrialBalanceData,
} from "@/lib/accounting/trial-balance";
import type { TrialBalanceRow } from "@/lib/types";

describe("getTrialBalance - Production Code", () => {
  describe("Period Opening Balance", () => {
    it("Test 76: Opening = fiscal opening when no prior movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 500, credit: 0 }]]),
        priorMovements: new Map(),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      assert.equal(rows[0].openingDebit, 500, "Opening debit should equal fiscal opening");
      assert.equal(rows[0].openingCredit, 0, "Opening credit should be zero");
    });

    it("Test 77: Opening = fiscal opening + prior debit movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 500, credit: 0 }]]),
        priorMovements: new Map([["acc1", { debit: 300, credit: 0 }]]),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Opening = 500 + 300 = 800 debit
      assert.equal(rows[0].openingDebit, 800);
      assert.equal(rows[0].openingCredit, 0);
    });

    it("Test 78: Opening = fiscal opening - prior credit movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 500, credit: 0 }]]),
        priorMovements: new Map([["acc1", { debit: 0, credit: 300 }]]),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Opening = 500 - 300 = 200 debit
      assert.equal(rows[0].openingDebit, 200);
      assert.equal(rows[0].openingCredit, 0);
    });

    it("Test 79: Opening with credit fiscal opening", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 0, credit: 200 }]]),
        priorMovements: new Map([["acc1", { debit: 50, credit: 0 }]]),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Opening = -200 + 50 = -150 → 150 credit
      assert.equal(rows[0].openingDebit, 0);
      assert.equal(rows[0].openingCredit, 150);
    });

    it("Test 80: Zero fiscal opening + prior movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map(),
        priorMovements: new Map([["acc1", { debit: 1000, credit: 200 }]]),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Opening = 0 + 1000 - 200 = 800 debit
      assert.equal(rows[0].openingDebit, 800);
      assert.equal(rows[0].openingCredit, 0);
    });
  });

  describe("Period Movements", () => {
    it("Test 81: Period debit and credit shown separately (no netting)", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 100, credit: 0 }]]),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 150, credit: 100 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Period movements shown separately
      assert.equal(rows[0].periodDebit, 150, "Period debit shown in full");
      assert.equal(rows[0].periodCredit, 100, "Period credit shown in full");
      // NOT netted to 50 debit
    });

    it("Test 82: Period with only debit movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map(),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 500, credit: 0 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      assert.equal(rows[0].periodDebit, 500);
      assert.equal(rows[0].periodCredit, 0);
    });

    it("Test 83: Period with only credit movements", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map(),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 0, credit: 300 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      assert.equal(rows[0].periodDebit, 0);
      assert.equal(rows[0].periodCredit, 300);
    });
  });

  describe("Closing Balance", () => {
    it("Test 84: Closing = opening + period debit - period credit", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 1000, credit: 0 }]]),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 500, credit: 200 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Closing = 1000 + 500 - 200 = 1300 debit
      assert.equal(rows[0].closingDebit, 1300);
      assert.equal(rows[0].closingCredit, 0);
    });

    it("Test 85: Closing balance converts negative to credit column", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 100, credit: 0 }]]),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 0, credit: 200 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Closing = 100 - 200 = -100 → 100 credit
      assert.equal(rows[0].closingDebit, 0, "Negative balance should have zero debit");
      assert.equal(rows[0].closingCredit, 100, "Negative balance shown as positive credit");
    });

    it("Test 86: Opening balance converts negative to credit column", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 0, credit: 500 }]]),
        priorMovements: new Map(),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Opening = -500 → 500 credit
      assert.equal(rows[0].openingDebit, 0);
      assert.equal(rows[0].openingCredit, 500, "Credit opening shown as positive");
    });
  });

  describe("Edge Cases", () => {
    it("Test 87: Account with no opening, no prior, no period", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map(),
        priorMovements: new Map(),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      assert.equal(rows[0].openingDebit, 0);
      assert.equal(rows[0].openingCredit, 0);
      assert.equal(rows[0].periodDebit, 0);
      assert.equal(rows[0].periodCredit, 0);
      assert.equal(rows[0].closingDebit, 0);
      assert.equal(rows[0].closingCredit, 0);
    });

    it("Test 88: Equal debit and credit result in zero closing", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([["acc1", { debit: 100, credit: 0 }]]),
        priorMovements: new Map(),
        periodMovements: new Map([["acc1", { debit: 0, credit: 100 }]]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      // Closing = 100 - 100 = 0
      assert.equal(rows[0].closingDebit, 0);
      assert.equal(rows[0].closingCredit, 0);
      // But period movements still shown
      assert.equal(rows[0].periodDebit, 0);
      assert.equal(rows[0].periodCredit, 100);
    });
  });

  describe("Multiple Accounts", () => {
    it("Test 89: Multiple accounts processed correctly", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
        {
          accountId: "acc2",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([
          ["acc1", { debit: 500, credit: 0 }],
          ["acc2", { debit: 0, credit: 300 }],
        ]),
        priorMovements: new Map([["acc1", { debit: 100, credit: 0 }]]),
        periodMovements: new Map([
          ["acc1", { debit: 50, credit: 0 }],
          ["acc2", { debit: 0, credit: 100 }],
        ]),
      };

      const rows = buildTrialBalanceRows(accounts, data);

      assert.equal(rows.length, 2);

      // Account 1: 500 + 100 = 600 opening, +50 period = 650 closing
      assert.equal(rows[0].openingDebit, 600);
      assert.equal(rows[0].closingDebit, 650);

      // Account 2: -300 opening, -100 period = -400 closing (400 credit)
      assert.equal(rows[1].openingCredit, 300);
      assert.equal(rows[1].closingCredit, 400);
    });
  });

  describe("Trial Balance Totals", () => {
    it("Test 90: Total opening debit = total opening credit", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
        {
          accountId: "acc2",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([
          ["acc1", { debit: 500, credit: 0 }],
          ["acc2", { debit: 0, credit: 500 }],
        ]),
        priorMovements: new Map(),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);
      const totals = calculateTrialBalanceTotals(rows);

      assert.equal(
        totals.totalOpeningDebit,
        totals.totalOpeningCredit,
        "Opening debit must equal opening credit"
      );
    });

    it("Test 91: Total period debit = total period credit", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
        {
          accountId: "acc2",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map(),
        priorMovements: new Map(),
        periodMovements: new Map([
          ["acc1", { debit: 300, credit: 0 }],
          ["acc2", { debit: 0, credit: 300 }],
        ]),
      };

      const rows = buildTrialBalanceRows(accounts, data);
      const totals = calculateTrialBalanceTotals(rows);

      assert.equal(
        totals.totalPeriodDebit,
        totals.totalPeriodCredit,
        "Period debit must equal period credit"
      );
    });

    it("Test 92: Total closing debit = total closing credit", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
        {
          accountId: "acc2",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([
          ["acc1", { debit: 500, credit: 0 }],
          ["acc2", { debit: 0, credit: 500 }],
        ]),
        priorMovements: new Map(),
        periodMovements: new Map([
          ["acc1", { debit: 100, credit: 50 }],
          ["acc2", { debit: 50, credit: 100 }],
        ]),
      };

      const rows = buildTrialBalanceRows(accounts, data);
      const totals = calculateTrialBalanceTotals(rows);

      assert.equal(
        totals.totalClosingDebit,
        totals.totalClosingCredit,
        "Closing debit must equal closing credit"
      );
    });

    it("Test 93: Header accounts excluded from totals", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "header1",
          code: "1000",
          nameAr: "الأصول",
          nameEn: "Assets",
          type: "ASSET",
          level: 1,
          isHeader: true,
        },
        {
          accountId: "acc1",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        fiscalOpenings: new Map([
          ["header1", { debit: 9999, credit: 0 }], // Should be ignored
          ["acc1", { debit: 500, credit: 0 }],
        ]),
        priorMovements: new Map(),
        periodMovements: new Map(),
      };

      const rows = buildTrialBalanceRows(accounts, data);
      const totals = calculateTrialBalanceTotals(rows);

      // Total should only include acc1 (500), not header1 (9999)
      assert.equal(totals.totalOpeningDebit, 500, "Header accounts must be excluded");
    });
  });

  describe("Integration: Full Scenario", () => {
    it("Test 94: Complete trial balance scenario", () => {
      const accounts: TrialBalanceAccount[] = [
        {
          accountId: "cash",
          code: "1010",
          nameAr: "النقدية",
          nameEn: "Cash",
          type: "ASSET",
          level: 2,
          isHeader: false,
        },
        {
          accountId: "payable",
          code: "2010",
          nameAr: "الدائنون",
          nameEn: "Payables",
          type: "LIABILITY",
          level: 2,
          isHeader: false,
        },
      ];

      const data: TrialBalanceData = {
        // Fiscal opening: Cash 1000 DR, Payables 1000 CR
        fiscalOpenings: new Map([
          ["cash", { debit: 1000, credit: 0 }],
          ["payable", { debit: 0, credit: 1000 }],
        ]),
        // Prior (before period): Cash +500 DR, Payables +500 CR
        priorMovements: new Map([
          ["cash", { debit: 500, credit: 0 }],
          ["payable", { debit: 0, credit: 500 }],
        ]),
        // Period: Cash +100 DR -50 CR, Payables +50 DR -100 CR
        periodMovements: new Map([
          ["cash", { debit: 100, credit: 50 }],
          ["payable", { debit: 50, credit: 100 }],
        ]),
      };

      const rows = buildTrialBalanceRows(accounts, data);
      const totals = calculateTrialBalanceTotals(rows);

      // Cash: opening 1500 DR, period +100-50, closing 1550 DR
      assert.equal(rows[0].openingDebit, 1500);
      assert.equal(rows[0].periodDebit, 100);
      assert.equal(rows[0].periodCredit, 50);
      assert.equal(rows[0].closingDebit, 1550);

      // Payables: opening 1500 CR, period +50-100, closing 1550 CR
      assert.equal(rows[1].openingCredit, 1500);
      assert.equal(rows[1].periodDebit, 50);
      assert.equal(rows[1].periodCredit, 100);
      assert.equal(rows[1].closingCredit, 1550);

      // Totals balanced
      assert.equal(totals.totalOpeningDebit, totals.totalOpeningCredit);
      assert.equal(totals.totalPeriodDebit, totals.totalPeriodCredit);
      assert.equal(totals.totalClosingDebit, totals.totalClosingCredit);
    });
  });
});
