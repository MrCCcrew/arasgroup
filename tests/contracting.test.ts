import assert from "node:assert/strict";
import { claimAmounts, movementLines, contractBalances } from "../lib/contracting/calculations";
import { inputSchema } from "../lib/contracting/input";

const claim = claimAmounts(1000, 10, 20, 150);
assert.equal(claim.retention.toFixed(3), "100.000");
assert.equal(claim.advanceRecovery.toFixed(3), "150.000");
assert.equal(claim.netAmount.toFixed(3), "750.000");
for (const customer of [true, false]) for (const kind of ["CLAIM", "ADVANCE", "SETTLEMENT", "RETENTION_RELEASE", "COST"]) {
  const result = movementLines({ ...claim, kind, category: "MATERIAL", cashAccountId: "cash" }, customer);
  assert(result.lines.length >= 2);
  assert.equal(result.lines.reduce((n, l) => n + Math.round(l.debit.toNumber() * 1000), 0), result.lines.reduce((n, l) => n + Math.round(l.credit.toNumber() * 1000), 0));
}
const balances = contractBalances([{ kind: "ADVANCE", amount: 150, retention: 0, advanceRecovery: 0, netAmount: 150 }, { kind: "CLAIM", ...claim }, { kind: "SETTLEMENT", amount: 300, retention: 0, advanceRecovery: 0, netAmount: 300 }]);
assert.equal(balances.advance.toFixed(3), "0.000");
assert.equal(balances.payable.toFixed(3), "450.000");
assert.equal(balances.retained.toFixed(3), "100.000");
assert.equal(claimAmounts("0.015", 10, 0, 0).retention.toFixed(3), "0.002");
assert(!inputSchema.safeParse({ action: "dailyLog", projectId: "p", date: "2026-02-30", description: "test", workersCount: 1, progressPercent: 10 }).success);
assert(!inputSchema.safeParse({ action: "document", projectId: "p", kind: "COST", date: "2026-01-01", reference: "x", description: "test", amount: 1.1234 }).success);
console.log("PASS: precise claims, retention, advance recovery, balanced journals and validation");
