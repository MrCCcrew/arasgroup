import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { POST } from "../app/api/hr/employees/route";
import { PATCH } from "../app/api/hr/employees/[employeeId]/route";
import { employeeListParams, employeeListWhere } from "../lib/hr/employee-list";

async function main() {
  const [{ db }] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
  assert.equal(db, "rashidgroup_test", "Only run against the test database");
  const group = await prisma.group.findFirstOrThrow();
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const headers = { "content-type": "application/json", "x-user-id": user.id, "x-user-email": "test@example.invalid", "x-user-superadmin": "true" };
  const residence = "الفروانية - سكن الشركة";
  const patch = (employeeId: string, body: object, requestHeaders = headers) => PATCH(new NextRequest(`http://localhost/api/hr/employees/${employeeId}`, {
    method: "PATCH", headers: requestHeaders, body: JSON.stringify(body),
  }), { params: Promise.resolve({ employeeId }) });
  try {
    await prisma.company.createMany({ data: [companyId, otherCompanyId].map(id => ({ id, groupId: group.id, nameAr: "Residence test", type: "GENERAL_TRADING" })) });
    const response = await POST(new NextRequest("http://localhost/api/hr/employees", { method: "POST", headers, body: JSON.stringify({
      companyId, nameAr: "موظف اختبار السكن", type: "OFFICE_EMPLOYEE", employeeNumber: "RES-101", residentialAddress: `  ${residence}  `,
    }) }));
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    const employeeId = body.data.id;
    assert.equal(body.data.residentialAddress, residence);
    await prisma.employee.createMany({ data: [
      { companyId, nameAr: "Other residence", type: "OFFICE_EMPLOYEE", residentialAddress: "السالمية" },
      { companyId: otherCompanyId, nameAr: "Other company", type: "OFFICE_EMPLOYEE", residentialAddress: residence },
      { companyId, nameAr: "Inactive", type: "OFFICE_EMPLOYEE", residentialAddress: residence, isActive: false },
      { companyId, nameAr: "Deleted", type: "OFFICE_EMPLOYEE", residentialAddress: residence, isDeleted: true },
    ] });
    const query = { residentialAddress: residence, search: "RES-101", category: "admins" };
    const reportQuery = Object.fromEntries(employeeListParams(query));
    assert.deepEqual(reportQuery, query);
    const rows = await prisma.employee.findMany({ where: employeeListWhere(companyId, reportQuery) });
    assert.deepEqual(rows.map(row => row.id), [employeeId]);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { residentialAddress: residence }) }), 1);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { residentialAddress: residence, status: "inactive" }) }), 1);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { residentialAddress: residence, status: "deleted" }) }), 1);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, query, ["inaccessible-branch"]) }), 0);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { ...query, residencyLicenseId: "not-assigned" }) }), 0);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { ...query, workPermitLicenseId: "not-assigned" }) }), 0);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { ...query, mainLicenseId: "not-assigned" }) }), 0);
    assert.equal(await prisma.employee.count({ where: employeeListWhere(companyId, { ...query, subLicenseId: "not-assigned" }) }), 0);
    let result = await patch(employeeId, { residentialAddress: "  حولي  " });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.residentialAddress, "حولي");
    result = await patch(employeeId, { nameAr: "Updated employee" });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.residentialAddress, "حولي", "Omitted address must be preserved");
    assert.equal((await patch(employeeId, { residentialAddress: "x".repeat(192) })).status, 400);
    assert.equal((await patch(employeeId, { residentialAddress: "Unauthorized" }, { ...headers, "x-user-superadmin": "false" })).status, 403);
    result = await patch(employeeId, { residentialAddress: "   " });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.residentialAddress, null);
    result = await patch(employeeId, { residentialAddress: null });
    assert.equal(result.status, 200);
    console.log("PASS: residence create/update/clear, validation, access checks, company isolation and combined report filters");
  } finally {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.employee.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
