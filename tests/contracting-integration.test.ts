import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { initializeCompanyChart } from "../lib/accounting/company-chart";
import { GET, POST } from "../app/api/companies/[companyId]/contracting/route";
import { postJournalEntry } from "../lib/accounting/journal-engine";
import { PATCH as updateCompany } from "../app/api/companies/[companyId]/route";

async function main() {
  const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
  assert.equal(db, "rashidgroup_test");
  const group = await prisma.group.findFirstOrThrow({ select: { id: true } });
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const ids: string[] = [];
  const headers = { "content-type": "application/json", "x-user-id": user.id, "x-user-email": "test@example.invalid", "x-user-superadmin": "true" };
  const invoke = async (companyId: string, body: object, expected = 200, auth: Record<string, string> = headers) => {
    const r = await POST(new NextRequest("http://localhost/api/test", { method: "POST", headers: auth, body: JSON.stringify(body) }), { params: Promise.resolve({ companyId }) });
    const result = await r.json(); assert.equal(r.status, expected, JSON.stringify(result)); return result.data;
  };
  const read = async (companyId: string, query = "", expected = 200) => {
    const r = await GET(new NextRequest(`http://localhost/api/test?${query}`, { headers }), { params: Promise.resolve({ companyId }) });
    const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body.data;
  };
  try {
    for (const type of ["CONTRACTING", "CONTRACTING", "TRADING"] as const) {
      const company = await prisma.$transaction(async tx => {
        const c = await tx.company.create({ data: { groupId: group.id, nameAr: "Construction integration", type } });
        await initializeCompanyChart(tx, c.id, type); return c;
      }, { timeout: 30000 }); ids.push(company.id);
    }
    const [companyId, other, trading] = ids;
    await read(trading, "", 404);
    const project = await invoke(companyId, { action: "project", code: "T1", name: "Test site", clientName: "Customer", budget: 9000, startDate: "2098-01-01" });
    const forbiddenChange = await updateCompany(new NextRequest("http://localhost/api/test", { method: "PATCH", headers, body: JSON.stringify({ type: "TRADING" }) }), { params: Promise.resolve({ companyId }) });
    assert.equal(forbiddenChange.status, 400);
    const contract = await invoke(companyId, { action: "contract", projectId: project.id, number: "C1", kind: "CUSTOMER", partyName: "Customer", value: 10000, retentionPercent: 10, advanceRecoveryPercent: 20 });
    await invoke(other, { action: "contract", projectId: project.id, number: "cross", kind: "CUSTOMER", partyName: "No", value: 1 }, 400);
    await read(other, `projectId=${project.id}`, 404);
    const cash = (await read(companyId)).cashAccounts[0].id;
    const foreignCash = (await read(other)).cashAccounts[0].id;
    const input = { action: "document", projectId: project.id, contractId: contract.id, date: "2098-01-02", description: "Work", cashAccountId: cash };
    const advance = await invoke(companyId, { ...input, kind: "ADVANCE", reference: "A1", amount: 2000 });
    await invoke(companyId, { action: "approve", documentId: advance.id });
    const claim = await invoke(companyId, { ...input, kind: "CLAIM", reference: "C1", amount: 5000 });
    assert.equal(Number(claim.netAmount), 3500);
    const unprivileged = { ...headers, "x-user-superadmin": "false", "x-user-companies": JSON.stringify([companyId]), "x-user-permissions": JSON.stringify([{ module: "CONTRACTING", action: "VIEW", scope: "COMPANY", companyId }, { module: "CONTRACTING", action: "CREATE", scope: "COMPANY", companyId }]) };
    await invoke(companyId, { action: "approve", documentId: claim.id }, 403, unprivileged);
    const attempts = await Promise.all([0, 1].map(() => POST(new NextRequest("http://localhost/api/test", { method: "POST", headers, body: JSON.stringify({ action: "approve", documentId: claim.id }) }), { params: Promise.resolve({ companyId }) })));
    assert.deepEqual(attempts.map(r => r.status).sort(), [200, 400]);
    assert.equal(await prisma.journalEntry.count({ where: { refId: claim.id, refModule: "CONTRACTING" } }), 1);
    await invoke(companyId, { action: "approve", documentId: claim.id }, 400);
    await invoke(companyId, { ...input, kind: "CLAIM", reference: "too-large", amount: 6000 }, 400);
    await invoke(companyId, { ...input, kind: "SETTLEMENT", reference: "overpay", amount: 4000 }, 400);
    await invoke(companyId, { ...input, kind: "SETTLEMENT", reference: "foreign-cash", amount: 1, cashAccountId: foreignCash }, 400);
    const settlement = await invoke(companyId, { ...input, kind: "SETTLEMENT", reference: "S1", amount: 1000 });
    await invoke(companyId, { action: "approve", documentId: settlement.id });
    const subcontract = await invoke(companyId, { action: "contract", projectId: project.id, number: "SC1", kind: "SUBCONTRACTOR", partyName: "Sub", value: 2000, retentionPercent: 10 });
    const subClaim = await invoke(companyId, { ...input, contractId: subcontract.id, kind: "CLAIM", reference: "SC1", amount: 1000 });
    await invoke(companyId, { action: "approve", documentId: subClaim.id });
    const cost = await invoke(companyId, { ...input, contractId: "", kind: "COST", category: "MATERIAL", reference: "M1", amount: 250 });
    await invoke(companyId, { action: "approve", documentId: cost.id });
    await invoke(companyId, { action: "dailyLog", projectId: project.id, date: "2098-01-02", workersCount: 8, progressPercent: 30, description: "Completed foundation" }, 200, unprivileged);
    const draftReport = await read(companyId, "month=2098-01"); assert.equal(Number(draftReport.report.revenue), 0);
    const journalIds = await prisma.journalEntry.findMany({ where: { companyId }, select: { id: true } });
    for (const journal of journalIds) {
      await prisma.journalEntry.update({ where: { id: journal.id }, data: { status: "APPROVED", approvedById: user.id } });
      await postJournalEntry(journal.id, user.id);
    }
    const report = await read(companyId, "month=2098-01");
    assert.equal(Number(report.report.revenue), 5000); assert.equal(Number(report.report.costs), 1250); assert.equal(Number(report.report.margin), 3750);
    assert.equal(Number(report.contracts[0].balances.payable), 2500);
    assert.equal(Number(report.contracts[0].balances.advance), 1000);
    assert.equal((await read(companyId, "month=2098-02")).documents.length, 0);
    await invoke(companyId, { action: "contractUpdate", projectId: project.id, contractId: contract.id, value: 4000, reason: "Below approved work" }, 400);
    await invoke(companyId, { action: "contractUpdate", projectId: project.id, contractId: contract.id, value: 12000, reason: "Approved variation" });
    const retained = await invoke(companyId, { ...input, kind: "RETENTION_RELEASE", reference: "R1", amount: 500 });
    await invoke(companyId, { action: "approve", documentId: retained.id });
    await invoke(companyId, { ...input, kind: "RETENTION_RELEASE", reference: "R2", amount: 1 }, 400);
    const locked = await invoke(companyId, { ...input, kind: "CLAIM", reference: "LOCKED", amount: 100 });
    await prisma.fiscalYear.updateMany({ where: { companyId }, data: { isLocked: true } });
    await invoke(companyId, { action: "approve", documentId: locked.id }, 400);
    assert.equal(await prisma.journalEntry.count({ where: { refId: locked.id } }), 0);
    assert.equal((await prisma.constructionDocument.findUniqueOrThrow({ where: { id: locked.id } })).status, "DRAFT");
    await prisma.fiscalYear.updateMany({ where: { companyId }, data: { isLocked: false } });
    await invoke(companyId, { action: "void", documentId: locked.id });
    await invoke(companyId, { action: "projectStatus", projectId: project.id, status: "COMPLETED" });
    await invoke(companyId, { ...input, kind: "ADVANCE", reference: "closed", amount: 1 }, 400);
    const conversion = await updateCompany(new NextRequest("http://localhost/api/test", { method: "PATCH", headers, body: JSON.stringify({ type: "CONTRACTING" }) }), { params: Promise.resolve({ companyId: trading }) });
    assert.equal(conversion.status, 200);
    assert(await prisma.chartOfAccount.findUnique({ where: { companyId_code: { companyId: trading, code: "4060" } }, select: { id: true } }));
    assert(await prisma.chartOfAccount.findUnique({ where: { companyId_code: { companyId: trading, code: "4050" } }, select: { id: true } }), "Existing trading accounts remain untouched");
    console.log("PASS: project lifecycle, customer/subcontractor claims, payments, site roles, company isolation, atomic approval, balanced posting and monthly report");
  } finally {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.constructionDocument.deleteMany({ where: { project: { companyId: { in: ids } } } });
    await prisma.constructionDailyLog.deleteMany({ where: { project: { companyId: { in: ids } } } });
    await prisma.constructionContract.deleteMany({ where: { project: { companyId: { in: ids } } } });
    await prisma.constructionProject.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.journalEntry.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.costCenter.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.chartOfAccount.updateMany({ where: { companyId: { in: ids } }, data: { parentId: null } });
    await prisma.chartOfAccount.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.fiscalYear.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
