import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractPdfText } from "../lib/owner-management/pdf-text";
import { parseNbkVisualRows } from "../lib/owner-management/nbk-parser";

async function main() {
  const bytes = new Uint8Array(await readFile("C:/Users/tamer/Downloads/nbk-owner-statement.pdf"));
  const extracted = await extractPdfText(bytes);
  const row = parseNbkVisualRows(extracted.visualRows).find((candidate) => candidate.mid === "796615002" && candidate.amount === "4.870");
  assert.equal(extracted.pageCount, 7);
  assert.ok(row, "expected the NBK sample operation for MID 796615002 and amount 4.870");
  assert.equal(row.transactionDate?.toISOString().slice(0, 10), "2026-06-30");
  assert.equal(row.postingDate?.toISOString().slice(0, 10), "2026-06-30");
  console.log("NBK sample date integration test passed");
}

void main();
