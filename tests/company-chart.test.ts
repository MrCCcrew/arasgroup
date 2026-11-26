import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { CompanyType } from "@prisma/client";
import { prisma } from "../lib/db";
import { companyChartTemplate, initializeCompanyChart } from "../lib/accounting/company-chart";
import { POST } from "../app/api/companies/route";

async function main() {
  for (const type of Object.values(CompanyType)) {
    const codes = new Set<string>();
    for (const account of companyChartTemplate(type)) {
      assert(!codes.has(account.code));
      if (account.parentCode) assert(codes.has(account.parentCode));
      codes.add(account.code);
    }
    for (const code of ["1000", "1010", "2010", "5010"]) assert(codes.has(code));
    assert.equal(codes.has("4010"), type === "DELIVERY");
    assert.equal(codes.has("4020"), type === "CAR_WASH");
    assert.equal(codes.has("1060"), type === "TRADING" || type === "GENERAL_TRADING");
    assert.equal(codes.has("4060"), type === "CONTRACTING");
    if (type === "CONTRACTING") for (const code of ["1200", "1210", "1220", "2040", "2050", "2060", "53", "5300", "5310", "5320", "5330", "5390"]) assert(codes.has(code));
  }
  const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
  assert.equal(db, "rashidgroup_test");
  const group = await prisma.group.findFirstOrThrow();
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const ids: string[] = [];
  const headers = { "content-type": "application/json", "x-user-id": user.id, "x-user-email": "test@example.invalid", "x-user-superadmin": "true" };
  try {
    for (const type of ["TRADING", "GENERAL_TRADING", "DELIVERY", "CAR_WASH", "CONTRACTING"] as const) {
      const response = await POST(new NextRequest("http://localhost/api/companies", { method: "POST", headers, body: JSON.stringify({ groupId: group.id, nameAr: `Chart test ${randomUUID()}`, type }) }));
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      ids.push(body.data.id);
      const accounts = await prisma.chartOfAccount.findMany({ where: { companyId: body.data.id }, select: { id: true, code: true, parentId: true } });
      assert.equal(accounts.length, companyChartTemplate(type).length);
      const parents = new Map(accounts.map(a => [a.code, a]));
      for (const template of companyChartTemplate(type)) {
        assert.equal(parents.get(template.code)?.parentId, template.parentCode ? parents.get(template.parentCode)?.id : null);
      }
      const existing = accounts[0];
      await prisma.chartOfAccount.update({ where: { id: existing.id }, data: { nameAr: "Customized", isActive: false }, select: { id: true } });
      assert.equal(await prisma.$transaction(tx => initializeCompanyChart(tx, body.data.id, type)), 0);
      assert.equal((await prisma.chartOfAccount.findUniqueOrThrow({ where: { id: existing.id }, select: { nameAr: true } })).nameAr, "Customized");
    }
    const rollbackId = randomUUID();
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.company.create({ data: { id: rollbackId, groupId: group.id, nameAr: "Rollback test", type: "TRADING" } });
      await initializeCompanyChart(tx, rollbackId, "TRADING");
      throw new Error("rollback");
    }, { timeout: 30000 }));
    assert.equal(await prisma.company.count({ where: { id: rollbackId } }), 0);
    assert.equal(await prisma.chartOfAccount.count({ where: { companyId: rollbackId } }), 0);
    console.log("PASS: activity templates, creation API, hierarchy, preservation and atomic rollback");
  } finally {
    await prisma.chartOfAccount.updateMany({ where: { companyId: { in: ids } }, data: { parentId: null } });
    await prisma.chartOfAccount.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
