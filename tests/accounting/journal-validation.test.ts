/**
 * Production Code Tests: Journal Validation
 *
 * Tests the ACTUAL production validation functions for journal entries.
 * Uses precise minor units (fils) calculation to avoid floating point errors.
 *
 * Kuwaiti Dinar: 1 KWD = 1000 fils, 3 decimal places
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toMinorUnits,
  validateJournalLines,
  validateBalance,
  validateJournalEntry,
} from "@/lib/accounting/journal-validation";

describe("Journal Validation - Production Code", () => {
  describe("toMinorUnits - Amount Conversion", () => {
    it("Test 95: Convert whole KWD to fils", () => {
      assert.equal(toMinorUnits(100), 100000);
      assert.equal(toMinorUnits(1), 1000);
      assert.equal(toMinorUnits(0), 0);
    });

    it("Test 96: Convert KWD with 1 decimal to fils", () => {
      assert.equal(toMinorUnits(100.1), 100100);
      assert.equal(toMinorUnits(0.5), 500);
    });

    it("Test 97: Convert KWD with 2 decimals to fils", () => {
      assert.equal(toMinorUnits(100.12), 100120);
      assert.equal(toMinorUnits(0.05), 50);
    });

    it("Test 98: Convert KWD with 3 decimals to fils", () => {
      assert.equal(toMinorUnits(100.125), 100125);
      assert.equal(toMinorUnits(0.001), 1);
    });

    it("Test 99: Reject more than 3 decimal places", () => {
      assert.throws(() => toMinorUnits(100.1234), {
        message: /أكثر من ثلاث منازل عشرية/,
      });
      assert.throws(() => toMinorUnits(0.0001));
    });

    it("Test 100: Reject NaN", () => {
      assert.throws(() => toMinorUnits(NaN), {
        message: /NaN أو Infinity/,
      });
    });

    it("Test 101: Reject Infinity", () => {
      assert.throws(() => toMinorUnits(Infinity), {
        message: /NaN أو Infinity/,
      });
      assert.throws(() => toMinorUnits(-Infinity));
    });

    it("Test 102: Reject negative values", () => {
      assert.throws(() => toMinorUnits(-100), {
        message: /لا يمكن أن يكون سالباً/,
      });
      assert.throws(() => toMinorUnits(-0.001));
    });

    it("Test 103: Handle floating point precision (0.1 + 0.2)", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const sum = 0.1 + 0.2;
      // Should accept it as 0.300 (300 fils)
      assert.equal(toMinorUnits(sum), 300);
    });
  });

  describe("validateJournalLines - Line Validation", () => {
    it("Test 104: Accept valid debit line", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });

    it("Test 105: Accept valid credit line", () => {
      const lines = [
        { accountId: "acc1", debit: 50, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 50, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });

    it("Test 106: Reject line with both debit and credit", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 50, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 50, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /مدينًا ودائنًا في نفس الوقت/,
      });
    });

    it("Test 107: Reject line with zero debit and credit", () => {
      const lines = [
        { accountId: "acc1", debit: 0, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 100, credit: 0, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /مبلغ مدين أو دائن/,
      });
    });

    it("Test 108: Accept null/undefined as zero", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: null as any, descriptionAr: "" },
        { accountId: "acc2", debit: undefined as any, credit: 100, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });

    it("Test 109: Reject empty accountId", () => {
      const lines = [
        { accountId: "", debit: 100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /يجب تحديد الحساب/,
      });
    });

    it("Test 110: Reject negative debit", () => {
      const lines = [
        { accountId: "acc1", debit: -100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /لا يمكن أن يكون المبلغ المدين سالباً/,
      });
    });

    it("Test 111: Reject negative credit", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: -100, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /لا يمكن أن يكون المبلغ الدائن سالباً/,
      });
    });

    it("Test 112: Reject entry with no debit side", () => {
      const lines = [
        { accountId: "acc1", debit: 0, credit: 100, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 50, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /طرف مدين واحد على الأقل/,
      });
    });

    it("Test 113: Reject entry with no credit side", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 50, credit: 0, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /طرف دائن واحد على الأقل/,
      });
    });

    it("Test 114: Reject single line entry", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 0, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /سطرين على الأقل/,
      });
    });

    it("Test 115: Reject empty array", () => {
      assert.throws(() => validateJournalLines([]), {
        message: /سطرين على الأقل/,
      });
    });

    it("Test 116: Accept multiple debit lines and one credit", () => {
      const lines = [
        { accountId: "acc1", debit: 50, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 50, credit: 0, descriptionAr: "" },
        { accountId: "acc3", debit: 0, credit: 100, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });

    it("Test 117: Accept one debit and multiple credit lines", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 60, descriptionAr: "" },
        { accountId: "acc3", debit: 0, credit: 40, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });

    it("Test 118: Reject line with more than 3 decimal places", () => {
      const lines = [
        { accountId: "acc1", debit: 100.1234, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100, descriptionAr: "" },
      ];
      assert.throws(() => validateJournalLines(lines), {
        message: /أكثر من ثلاث منازل عشرية/,
      });
    });

    it("Test 119: Accept amounts with exactly 3 decimal places", () => {
      const lines = [
        { accountId: "acc1", debit: 100.125, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100.125, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateJournalLines(lines));
    });
  });

  describe("validateBalance - Balance Precision", () => {
    it("Test 120: Accept perfectly balanced entry", () => {
      const lines = [
        { accountId: "acc1", debit: 100.000, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100.000, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateBalance(lines));
    });

    it("Test 121: Reject 0.001 difference (1 fils)", () => {
      const lines = [
        { accountId: "acc1", debit: 100.001, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100.000, descriptionAr: "" },
      ];
      assert.throws(() => validateBalance(lines), {
        message: /غير متوازن/,
      });
    });

    it("Test 122: Reject 0.002 difference", () => {
      const lines = [
        { accountId: "acc1", debit: 100.002, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100.000, descriptionAr: "" },
      ];
      assert.throws(() => validateBalance(lines), {
        message: /غير متوازن/,
      });
    });

    it("Test 123: Accept 0.1 + 0.2 = 0.3 (floating point edge case)", () => {
      const lines = [
        { accountId: "acc1", debit: 0.1, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0.2, credit: 0, descriptionAr: "" },
        { accountId: "acc3", debit: 0, credit: 0.3, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateBalance(lines));
    });

    it("Test 124: Reject zero total entry", () => {
      const lines = [
        { accountId: "acc1", debit: 0, credit: 0, descriptionAr: "" },
      ];
      assert.throws(() => validateBalance(lines), {
        message: /قيمة صفرية/,
      });
    });

    it("Test 125: Accept complex multi-line balanced entry", () => {
      const lines = [
        { accountId: "acc1", debit: 50.125, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 30.500, credit: 0, descriptionAr: "" },
        { accountId: "acc3", debit: 19.375, credit: 0, descriptionAr: "" },
        { accountId: "acc4", debit: 0, credit: 100.000, descriptionAr: "" },
      ];
      assert.doesNotThrow(() => validateBalance(lines));
    });

    it("Test 126: Reject complex entry with 1 fils difference", () => {
      const lines = [
        { accountId: "acc1", debit: 50.125, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 30.500, credit: 0, descriptionAr: "" },
        { accountId: "acc3", debit: 19.375, credit: 0, descriptionAr: "" },
        { accountId: "acc4", debit: 0, credit: 99.999, descriptionAr: "" },
      ];
      assert.throws(() => validateBalance(lines), {
        message: /غير متوازن/,
      });
    });
  });

  describe("validateJournalEntry - Combined Validation", () => {
    it("Test 127: Accept valid complete entry", () => {
      const lines = [
        { accountId: "acc1", debit: 100.125, credit: 0, descriptionAr: "Test" },
        { accountId: "acc2", debit: 0, credit: 50.000, descriptionAr: "Test" },
        { accountId: "acc3", debit: 0, credit: 50.125, descriptionAr: "Test" },
      ];
      assert.doesNotThrow(() => validateJournalEntry(lines));
    });

    it("Test 128: Reject entry with line errors before balance check", () => {
      const lines = [
        { accountId: "acc1", debit: 100, credit: 50, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 50, descriptionAr: "" },
      ];
      // Should fail on line validation, not balance
      assert.throws(() => validateJournalEntry(lines), {
        message: /مدينًا ودائنًا/,
      });
    });

    it("Test 129: Reject entry with balance error after line validation", () => {
      const lines = [
        { accountId: "acc1", debit: 100.001, credit: 0, descriptionAr: "" },
        { accountId: "acc2", debit: 0, credit: 100.000, descriptionAr: "" },
      ];
      // Lines are valid individually, but balance is off
      assert.throws(() => validateJournalEntry(lines), {
        message: /غير متوازن/,
      });
    });
  });
});
