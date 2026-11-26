import assert from "node:assert/strict";
import { entryDate, entryDateFilter, entrySchema } from "../lib/owner-management/entries";

const february = entryDateFilter({ month: "2024-02", from: "2020-01-01" });
assert.equal(february.gte?.toISOString(), "2024-02-01T00:00:00.000Z");
assert.equal("lt" in february && february.lt.toISOString(), "2024-03-01T00:00:00.000Z");
const december = entryDateFilter({ month: "2026-12" });
assert.equal("lt" in december && december.lt.toISOString(), "2027-01-01T00:00:00.000Z");
assert.equal(entryDate("2025-02-29"), undefined);
assert.equal(entryDate("2024-02-29")?.toISOString(), "2024-02-29T00:00:00.000Z");
assert.deepEqual(entryDateFilter({ month: "2026-13", from: "invalid" }), {});
const range = entryDateFilter({ to: "2026-09-20" });
assert.equal("lte" in range && range.lte?.toISOString(), "2026-09-20T23:59:59.999Z");
const input = { kind: "receipt", partnerId: "partner-1", date: "2026-09-20", amount: 12.345 };
for (const kind of ["receipt", "payment", "revenue", "expense"]) assert.ok(entrySchema.safeParse({ ...input, kind }).success);
for (const amount of [0, -1, Infinity, NaN, 0.0001, 1.1234, 100000001]) assert.ok(!entrySchema.safeParse({ ...input, amount }).success);
assert.ok(!entrySchema.safeParse({ ...input, date: "2026-02-30" }).success);
assert.ok(!entrySchema.safeParse({ ...input, partnerId: "" }).success);
console.log("Owner management entry validation and month filter tests passed");
