import assert from "node:assert/strict";
import { needsNbkOcr, type NbkVisualRow } from "../lib/owner-management/pdf-text";

const row: NbkVisualRow = { pageNumber: 1, y: 248, transactionDate: "2026/06/30", postingDate: "2026/06/30", amount: "4.870", description: "", rawRowText: "766.625 4.870 2026/06/30 13200 2026/06/30" };
assert.equal(needsNbkOcr([row]), true, "extractable amounts/dates must not suppress OCR for missing descriptions");
assert.equal(needsNbkOcr(Array.from({ length: 100 }, () => row)), true);
assert.equal(needsNbkOcr([{ ...row, description: "  " }]), true);
assert.equal(needsNbkOcr([]), false);
assert.equal(needsNbkOcr([{ ...row, description: "MID 796615002 0000002187258211" }]), false, "text statements retain the fast path");
assert.equal(needsNbkOcr([{ ...row, description: "Normal Fee" }]), false, "non-merchant transactions do not require OCR just because they have no MID");
console.log("NBK OCR fallback tests passed");
