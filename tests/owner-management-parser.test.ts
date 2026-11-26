import assert from "node:assert/strict";
import { extractMid, extractTransactionReference, normalizeMid } from "../lib/owner-management/nbk-parser";
assert.equal(normalizeMid("٧٩٦٦١٥٠٠٣"), "796615003");
assert.equal(extractMid("2806 MID 796615003 0000002186420290"), "796615003");
assert.notEqual(extractMid("MID 796615003"), "796615002");
assert.notEqual(extractMid("MID 796615003"), "796615001");
assert.equal(extractTransactionReference("MID 796615003 0000002186420290"), "0000002186420290");
assert.equal(extractMid("إيداع نقدي 796615003"), null);
console.log("owner-management parser tests passed");
