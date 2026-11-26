import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { GET, POST } from "../app/api/delivery/contracts/[contractId]/hourly/route";
import { PATCH as updateContract } from "../app/api/delivery/contracts/[contractId]/route";
import { loadHourlyReport, summarizeHourlyReport } from "../lib/delivery/hourly-report";

async function main() {
  const databases = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
  assert.equal(databases[0].db, "rashidgroup_test", "Integration test must use the dedicated test database");
  const driver = await prisma.driver.findFirstOrThrow({ where: { employee: { isDeleted: false, isActive: true } }, include: { employee: { select: { companyId: true } } } });
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const companyId = driver.employee.companyId;
  const ids: string[] = [];
  const resourceIds: string[] = [];
  const makeContract = async () => {
    const contract = await prisma.deliveryContract.create({ data: { companyId, nameAr: `Hourly integration ${randomUUID()}`, startDate: new Date("2098-01-01"), endDate: new Date("2098-12-31"), usesHourlyWork: true, defaultHourlyRate: "1.250" } });
    ids.push(contract.id); return contract;
  };
  const headers = { "content-type": "application/json", "x-user-id": user.id, "x-user-email": "test@example.invalid", "x-user-superadmin": "true" };
  const invoke = async (contractId: string, body: object, expected = 200) => {
    const response = await POST(new NextRequest("http://localhost/api/test", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ contractId }) });
    const json = await response.json();
    assert.equal(response.status, expected, JSON.stringify(json));
    if (json.data?.id) resourceIds.push(json.data.id);
    return json.data;
  };
  try {
    const contract = await makeContract(); const other = await makeContract();
    const contractResponse = await updateContract(new NextRequest("http://localhost/api/test", { method: "PATCH", headers, body: JSON.stringify({ platform: "CUSTOM", nameEn: null, notes: null, defaultHourlyRate: 1.25 }) }), { params: Promise.resolve({ contractId: contract.id }) });
    assert.equal(contractResponse.status, 200);
    const updatedContract = (await contractResponse.json()).data;
    assert.equal(updatedContract.startDate, "2098-01-01T00:00:00.000Z");
    assert.equal(updatedContract.endDate, "2098-12-31T00:00:00.000Z");
    const eyed = await invoke(contract.id, { action: "entity", name: "eyed", hourlyRate: null });
    const second = await invoke(contract.id, { action: "entity", name: "Second entity", hourlyRate: 2 });
    const foreign = await invoke(other.id, { action: "entity", name: "Other contract entity", hourlyRate: 3 });
    const input = { action: "entry", driverId: driver.id, workEntityId: eyed.id, date: "2098-02-01", minutes: 480, ordersCount: 12 };
    const first = await invoke(contract.id, input);
    assert.equal(Number(first.amount), 10);
    assert.equal(first.ordersCount, 12);
    await invoke(contract.id, input, 409);
    await invoke(contract.id, { ...input, workEntityId: foreign.id }, 400);
    await invoke(contract.id, { ...input, date: "2099-01-01" }, 400);
    const secondEntry = await invoke(contract.id, { ...input, workEntityId: second.id, minutes: 120, ordersCount: 3 });
    assert.equal(Number(secondEntry.amount), 4);
    await invoke(other.id, { ...input, workEntityId: foreign.id, minutes: 900 }, 400);
    await invoke(contract.id, { action: "entity", id: eyed.id, name: "eyed", hourlyRate: 5 });
    const changedOrders = await invoke(contract.id, { ...input, id: first.id, ordersCount: 99 });
    assert.equal(Number(changedOrders.amount), 10, "Changing orders or entity default must preserve historical amount");
    const summary = await GET(new NextRequest(`http://localhost/api/test?month=2098-02&driverId=${driver.id}`, { headers }), { params: Promise.resolve({ contractId: contract.id }) });
    const summaryBody = await summary.json();
    assert.equal(summaryBody.data.totalMinutes, 600);
    assert.equal(summaryBody.data.totalOrders, 102);
    assert.equal(Number(summaryBody.data.totalAmount), 14);
    const report = await loadHourlyReport(companyId, contract.id, { from: "2098-02-01", to: "2098-02-01", driverId: driver.id });
    const reportSummary = summarizeHourlyReport(report.rows);
    assert.equal(reportSummary.minutes, 600);
    assert.equal(reportSummary.orders, 102);
    assert.equal(reportSummary.amount.toFixed(3), "14.000");
    assert.equal((await loadHourlyReport(companyId, contract.id, { from: "2098-02-01", to: "2098-02-01", workEntityId: second.id })).rows.length, 1);
    assert.equal((await loadHourlyReport("different-company", contract.id, { from: "2098-02-01", to: "2098-02-01" })).rows.length, 0);
    const filtered = await GET(new NextRequest(`http://localhost/api/test?month=2098-02&workEntityId=${second.id}`, { headers }), { params: Promise.resolve({ contractId: contract.id }) });
    assert.equal((await filtered.json()).data.total, 1);
    const denied = await POST(new NextRequest("http://localhost/api/test", { method: "POST", headers: { ...headers, "x-user-superadmin": "false" }, body: JSON.stringify(input) }), { params: Promise.resolve({ contractId: contract.id }) });
    assert.equal(denied.status, 403);
    const concurrentInput = { ...input, date: "2098-02-02", minutes: 800 };
    const concurrent = await Promise.all([
      POST(new NextRequest("http://localhost/api/test", { method: "POST", headers, body: JSON.stringify(concurrentInput) }), { params: Promise.resolve({ contractId: contract.id }) }),
      POST(new NextRequest("http://localhost/api/test", { method: "POST", headers, body: JSON.stringify({ ...concurrentInput, workEntityId: second.id }) }), { params: Promise.resolve({ contractId: contract.id }) }),
    ]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 400], "concurrent entries must respect the driver's daily 24-hour limit");
    for (const response of concurrent) { const body = await response.json(); if (body.data?.id) resourceIds.push(body.data.id); }
    await invoke(contract.id, { action: "deleteEntry", id: first.id });
    assert.equal(await prisma.deliveryHourlyWorkEntry.count({ where: { id: first.id } }), 0);
    assert.ok(await prisma.auditLog.count({ where: { resourceId: first.id, action: "DELETE_HOURLY_WORK" } }));
    console.log("Hourly integration passed: create/edit/delete, rate snapshots, order counts, monthly totals, tenant isolation, daily limit and audit");
  } finally {
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: resourceIds }, module: "delivery" } });
    await prisma.deliveryHourlyWorkEntry.deleteMany({ where: { contractId: { in: ids } } });
    await prisma.deliveryWorkEntity.deleteMany({ where: { contractId: { in: ids } } });
    await prisma.deliveryContract.deleteMany({ where: { id: { in: ids } } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
