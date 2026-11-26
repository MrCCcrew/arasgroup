import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { GET, PUT } from "../app/api/companies/[companyId]/voucher-print-settings/route";
import { effectiveVoucherPrintSettings } from "../lib/accounting/voucher-print-settings";

async function main() {
  const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
  assert.equal(db, "rashidgroup_test");
  await prisma.$executeRawUnsafe(readFileSync("prisma/migrations/20260921_company_voucher_print_settings/migration.sql", "utf8"));
  const group = await prisma.group.findFirstOrThrow({ select: { id: true } });
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const ids: string[] = [];
  const headers = { "content-type": "application/json", "x-user-id": user.id, "x-user-email": "test@example.invalid", "x-user-superadmin": "true" };
  const call = (id: string, method: "GET" | "PUT", data?: unknown, customHeaders = headers) => (method === "GET" ? GET : PUT)(new NextRequest("http://localhost/api/test", { method, headers: customHeaders, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), { params: Promise.resolve({ companyId: id }) });
  try {
    for (let i = 0; i < 2; i++) ids.push((await prisma.company.create({ data: { nameAr: `Print settings test ${i}`, type: "TRADING", groupId: group.id }, select: { id: true } })).id);
    const [a, b] = ids;
    const read = async (id: string) => (await (await call(id, "GET")).json()).data;
    assert.deepEqual(await read(a), { copies: 2, orientation: "portrait" });
    assert.equal((await call(a, "PUT", { copies: 1, orientation: "landscape" })).status, 200);
    assert.deepEqual(await read(a), { copies: 1, orientation: "landscape" });
    assert.deepEqual(await read(b), { copies: 2, orientation: "portrait" }, "Other company must be unaffected");
    for (const invalid of [{ copies: 3, orientation: "landscape" }, { copies: 1, orientation: "diagonal" }, { copies: 1, orientation: "landscape", companyId: b }]) assert.equal((await call(a, "PUT", invalid)).status, 400);
    const unprivileged = { ...headers, "x-user-superadmin": "false" };
    assert.equal((await call(a, "PUT", { copies: 2, orientation: "portrait" }, unprivileged)).status, 403);
    assert.equal((await call(a, "GET", undefined, unprivileged)).status, 403);
    assert.deepEqual(effectiveVoucherPrintSettings("GENERAL", { copies: 1, orientation: "landscape" }), { copies: 2, orientation: "portrait" });
    for (const type of ["PAYMENT", "RECEIPT"]) assert.deepEqual(effectiveVoucherPrintSettings(type, { copies: 1, orientation: "landscape" }), { copies: 1, orientation: "landscape" });
    console.log("PASS: saved preferences, company isolation, validation, authorization and voucher-only behavior");
  } finally {
    await prisma.auditLog.deleteMany({ where: { resourceType: "VoucherPrintSettings", resourceId: { in: ids } } });
    await prisma.companyVoucherPrintSettings.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
