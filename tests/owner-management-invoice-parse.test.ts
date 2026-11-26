import assert from "node:assert/strict";
import { parseInvoiceText } from "../lib/delivery/invoice-parse";

assert.deepEqual(parseInvoiceText("Receipt\nDate: 2026/06/15\nTotal: 12.500 KWD"), { date: "2026-06-15", amount: 12.5 });
assert.deepEqual(parseInvoiceText("التاريخ ١٥-٠٦-٢٠٢٦\nالإجمالي ٧.٢٥٠ د.ك"), { date: "2026-06-15", amount: 7.25 });
assert.deepEqual(parseInvoiceText("Invoice date 15 June 2026\nAmount KD 3.750"), { date: "2026-06-15", amount: 3.75 });
assert.deepEqual(parseInvoiceText("Date: 06/15/2026\nGrand Total 1.500 KWD"), { date: "2026-06-15", amount: 1.5 });
console.log("owner-management invoice parsing tests passed");
