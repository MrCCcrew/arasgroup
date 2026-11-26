import assert from "node:assert/strict";
import { journalListHref, journalMonthRange, journalPage, journalPageNumbers } from "../lib/accounting/journal-list";

assert.equal(journalMonthRange("2024-02")?.gte.toISOString(), "2024-02-01T00:00:00.000Z");
assert.equal(journalMonthRange("2024-02")?.lt.toISOString(), "2024-03-01T00:00:00.000Z");
assert.equal(journalMonthRange("2026-12")?.lt.toISOString(), "2027-01-01T00:00:00.000Z");
for (const month of [undefined, "", "invalid", "2026-13", "2026-00", "26-01"]) assert.equal(journalMonthRange(month), undefined);
for (const page of [undefined, "-1", "0", "bad", "3x", "Infinity"]) assert.equal(journalPage(page, 1500), 1);
assert.equal(journalPage("99", 41), 3);
assert.equal(journalPage("2", 41), 2);
assert.equal(journalPage("99", 0), 1);
for (let page = 1; page <= 1000; page++) {
  const pages = journalPageNumbers(page, 1000);
  assert(pages.length <= 5);
  assert(pages.includes(page) && pages.includes(1) && pages.includes(1000));
}
const url = new URL(journalListHref("company-a", { page: 2, status: "POSTED", search: "سند & قبض", month: "2026-09" }), "http://localhost");
assert.equal(url.searchParams.get("search"), "سند & قبض");
assert.equal(url.searchParams.get("month"), "2026-09");
assert.equal(url.searchParams.get("status"), "POSTED");
assert.equal(url.searchParams.get("page"), "2");
const all = new URL(journalListHref("company-a", { search: "test", month: "2026-09", status: "" }), "http://localhost");
assert.equal(all.searchParams.get("search"), "test");
assert(!all.searchParams.has("status") && !all.searchParams.has("page"));
console.log("PASS: month boundaries, invalid inputs, page clamping, compact navigation and filter preservation");
