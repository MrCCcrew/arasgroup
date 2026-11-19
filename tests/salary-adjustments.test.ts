import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSalaryBatchDraft, type SalaryPaymentDraftInput } from "../lib/hr/salary-batch-builder";
import { adjustmentTotal, restoreSalaryAdjustments, salaryAdjustmentDetailsSchema } from "../lib/hr/salary-adjustments";
import { buildSalaryWhatsAppMessage } from "../lib/whatsapp";
import { salaryPaymentItemsWhere } from "../lib/hr/salary-items";

const legacy: SalaryPaymentDraftInput = {
  employeeId: "driver-1", baseAmount: 200, incentives: 10, foodAllowance: 15,
  companyAddition: 20, fuelAddition: 5, additionalEarnings: 3,
  companyDeduction: 12, targetDeduction: 4, deductions: 2,
};
const details = {
  companyAddition: [
    { titleAr: "مكافأة", titleEn: "Bonus", amount: 10.125 },
    { titleAr: "تعويض مصروفات", titleEn: "Expense reimbursement", amount: 4.875 },
  ],
  companyDeduction: [
    { titleAr: "سلفة", titleEn: "Salary advance", amount: 6.250 },
    { titleAr: "غياب يوم", amount: 2.750 },
    { titleAr: "غياب يوم", amount: 1 },
  ],
};

test("itemized amounts replace aggregate inputs and reconcile with net salary", () => {
  const draft = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: details }]);
  const payment = draft.payments[0];
  assert.equal(payment.additionalEarnings, 38);
  assert.equal(payment.deductions, 16);
  assert.equal(payment.netAmount, 232);
  assert.equal(draft.totalGross, 248);
  assert.equal(draft.totalNet, 232);
  assert.equal(draft.items.filter(item => item.type === "COMPANY_ADDITION").length, 2);
  assert.equal(draft.items.filter(item => item.type === "COMPANY_DEDUCTION").length, 3);
  assert.equal(draft.items.find(item => item.titleAr === "غياب يوم")?.titleEn, "غياب يوم");
  const itemNet = draft.items.reduce((sum, item) => sum + (item.category === "EARNING" ? item.amount : -item.amount), 0);
  assert.equal(itemNet, payment.netAmount);
  assert.equal(legacy.companyAddition, 20);
});

test("legacy aggregates remain compatible and clearing all items removes their amount", () => {
  assert.equal(buildSalaryBatchDraft([legacy]).totalNet, 235);
  const cleared = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: { companyAddition: [], companyDeduction: [] } }]);
  assert.equal(cleared.totalNet, 227);
  assert.equal(cleared.items.some(item => item.type === "COMPANY_ADDITION" || item.type === "COMPANY_DEDUCTION"), false);
});

test("editing a saved driver batch preserves every repeated item and amount", () => {
  const original = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: details }]);
  const restored = restoreSalaryAdjustments(original.items, legacy.employeeId, true);
  const edited = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: restored }]);
  assert.deepEqual(edited.items, original.items);
  assert.equal(edited.totalNet, original.totalNet);
  assert.equal(restored.companyDeduction?.length, 3);
  assert.equal(restoreSalaryAdjustments(original.items, "another-employee", true).companyDeduction, undefined);
});

test("selected deduction labels survive saving and reopening the salary batch", () => {
  const selected = [
    { titleAr: "كاش معلق", titleEn: "Outstanding cash", amount: 11.550 },
    { titleAr: "تذكرة طيران", titleEn: "Air ticket", amount: 25 },
    { titleAr: "خصم مرحل من شهر سابق", titleEn: "Deduction carried forward from a previous month", amount: 5 },
  ];
  const saved = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: { companyDeduction: selected } }]);
  const reloaded = restoreSalaryAdjustments(JSON.parse(JSON.stringify(saved.items)), legacy.employeeId, true);
  assert.deepEqual(reloaded.companyDeduction, selected);
  const resaved = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: reloaded }]);
  assert.equal(resaved.totalNet, saved.totalNet);
  assert.deepEqual(resaved.items, saved.items);
});

test("other employees can itemize additions and deductions without double counting existing typed items", () => {
  const oldDriver = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: details }]);
  const restored = restoreSalaryAdjustments(oldDriver.items, legacy.employeeId, false);
  const draft = buildSalaryBatchDraft([{
    ...legacy, foodAllowance: 0, companyAddition: 0, fuelAddition: 0,
    companyDeduction: 0, targetDeduction: 0, adjustmentDetails: restored,
  }]);
  assert.equal(draft.totalNet, oldDriver.totalNet);
  assert.equal(draft.payments[0].additionalEarnings, 38);
  assert.equal(draft.payments[0].deductions, 16);
  assert.equal(restored.additionalEarnings?.length, 5);
  assert.equal(restored.deductions?.length, 5);
});

test("invalid names, amounts and excessive precision cannot be persisted", () => {
  for (const item of [
    { titleAr: " ", amount: 1 }, { titleAr: "سلفة", amount: -1 },
    { titleAr: "سلفة", amount: 0 }, { titleAr: "سلفة", amount: NaN },
    { titleAr: "سلفة", amount: Infinity }, { titleAr: "سلفة", amount: 1.2345 },
    { titleAr: "أ".repeat(192), amount: 1 },
  ]) {
    assert.equal(salaryAdjustmentDetailsSchema.safeParse({ companyDeduction: [item] }).success, false);
    assert.throws(() => buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: { companyDeduction: [item] } }]));
  }
  assert.equal(salaryAdjustmentDetailsSchema.safeParse({ companyAddition: Array(101).fill({ titleAr: "مكافأة", amount: 1 }) }).success, false);
  assert.equal(adjustmentTotal([{ titleAr: "أ", amount: 0.1 }, { titleAr: "ب", amount: 0.2 }]), 0.3);
});

test("WhatsApp salary details include each addition and deduction in both languages", () => {
  const draft = buildSalaryBatchDraft([{ ...legacy, adjustmentDetails: details }]);
  for (const locale of ["ar", "en"] as const) {
    const message = buildSalaryWhatsAppMessage({
      locale, employeeName: "Test", month: 9, year: 2026,
      baseAmount: 200, incentives: 10, additionalEarnings: 38, deductions: 16,
      netWithoutIncentive: 222, netAmount: 232, items: draft.items, pdfUrl: "https://example.test/slip.pdf",
    });
    assert.ok(message.includes(locale === "ar" ? "مكافأة" : "Bonus"));
    assert.ok(message.includes(locale === "ar" ? "تعويض مصروفات" : "Expense reimbursement"));
    assert.ok(message.includes(locale === "ar" ? "سلفة" : "Salary advance"));
    assert.equal(message.split("غياب يوم").length - 1, 2);
    assert.ok(message.includes("https://example.test/slip.pdf"));
    if (locale === "en") {
      assert.ok(message.includes("10.125"));
      assert.ok(message.includes("6.250"));
    }
  }
});

test("salary item lookup includes legacy employee items only within the same batch", () => {
  assert.deepEqual(salaryPaymentItemsWhere({ id: "payment-1", employeeId: "employee-1", batchId: "batch-1" }), {
    batchId: "batch-1",
    OR: [{ salaryPaymentId: "payment-1" }, { salaryPaymentId: null, employeeId: "employee-1" }],
  });
});
