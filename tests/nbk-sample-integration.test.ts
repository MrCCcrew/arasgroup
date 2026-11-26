import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractPdfText } from "../lib/owner-management/pdf-text";
import { parseNbkVisualRows } from "../lib/owner-management/nbk-parser";

async function main() {
  const bytes = new Uint8Array(await readFile(process.env.NBK_SAMPLE_PDF || "C:/Users/tamer/Downloads/nbk-owner-statement.pdf"));
  const extracted = await extractPdfText(bytes);
  const rows = parseNbkVisualRows(extracted.visualRows);
  const row = rows.find((candidate) => candidate.mid === "796615002" && candidate.amount === "4.870");
  assert.equal(extracted.pageCount, 7);
  assert.ok(row, "expected the NBK sample operation for MID 796615002 and amount 4.870");
  assert.equal(row.transactionDate?.toISOString().slice(0, 10), "2026-06-30");
  assert.equal(row.postingDate?.toISOString().slice(0, 10), "2026-06-30");
  assert.equal(row.transactionReference, "0000002187258211");
  // Adjacent rows belong to different merchants; OCR must not swap their IDs.
  for (const [amount, mid, reference] of [
    ["2.045", "796615001", "0000002187258210"],
    ["4.970", "796615003", "0000002187066728"],
    ["2.982", "796615002", "0000002187062033"],
  ]) {
    const adjacent = rows.find(candidate => candidate.pageNumber === 1 && candidate.amount === amount);
    assert.equal(adjacent?.mid, mid);
    assert.equal(adjacent?.transactionReference, reference);
  }
  assert.equal(rows.length, 179);
  // Reconcile all seven pages to the credit/debit totals printed on page one.
  const mills = rows.map(candidate => Math.round(Number(candidate.amount.replace(/,/g, "")) * 1000));
  assert.equal(mills.filter(amount => amount > 0).reduce((sum, amount) => sum + amount, 0), 13611620);
  assert.equal(mills.filter(amount => amount < 0).reduce((sum, amount) => sum + amount, 0), -14146660);
  console.log(`NBK sample integration passed: ${rows.length} operations, merchant/reference mapping and statement totals verified`);
}

void main();
