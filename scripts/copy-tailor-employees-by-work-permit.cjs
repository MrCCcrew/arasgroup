const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sourceCompanyId = "co-silver-valley";

// Work permit is the single authoritative allocation rule.  Each destination
// license below is an independent copy created in the preceding correction.
const destinations = {
  cmqzlj4m80003l1qoj5kqzoqi: { companyId: "cmwnu3q5r00k5l1l2l6k3qh9j", licenseId: "cmwquhvq30002l1lmxbtksvzq", label: "Lisciano Fabrics" },
  cmqzlj4nd0007l1qo19g0ok7h: { companyId: "cmwnu188j00hhl1l2v8d9u1r1", licenseId: "cmwquhvs3000ll1lmscfo7sv3", label: "Lisciano Shared" },
  cmqy4ucto0011l143chnhwhse: { companyId: "cmwntzjce00epl1l2okp6d2xw", licenseId: "cmwquhvtq0016l1lmt290sxvt", label: "Venus Tailor" },
  cmqzlj4mg0005l1qouqwtjqog: { companyId: "cmwntypkt00bxl1l2igkz259b", licenseId: "cmwquhvv0001ll1lmg39fl9j3", label: "Al Jadi Tailor" },
  cmqy4ucu00013l1439hm946ci: { companyId: "cmwntxibv0095l1l2p0otp121", licenseId: "cmwquhvw30026l1lm9x5uprpe", label: "Al Awhad Tailor" },
};

function omit(row, extra = []) {
  const data = { ...row };
  for (const key of ["id", "companyId", "branchId", "investorId", "licenseId", "residencyLicenseId", "workPermitLicenseId", "positionId", "createdAt", "updatedAt", ...extra]) delete data[key];
  return data;
}

async function copyEmployee(tx, employee) {
  const destination = destinations[employee.workPermitLicenseId];
  if (!destination) throw new Error(`No destination for ${employee.id}`);

  // Civil ID is unique per company. This makes the operation retry-safe.
  let target = employee.civilId ? await tx.employee.findFirst({ where: { companyId: destination.companyId, civilId: employee.civilId } }) : null;
  let created = false;
  if (!target) {
    target = await tx.employee.create({
      data: {
        ...omit(employee),
        companyId: destination.companyId,
        branchId: null,
        investorId: null,
        positionId: null,
        // The copied work permit is the basis of all three license pointers.
        licenseId: destination.licenseId,
        residencyLicenseId: destination.licenseId,
        workPermitLicenseId: destination.licenseId,
      },
    });
    created = true;
  }

  const assignment = await tx.employeeLicenseAssignment.findFirst({ where: { employeeId: target.id, licenseId: destination.licenseId } });
  if (!assignment) await tx.employeeLicenseAssignment.create({ data: { employeeId: target.id, licenseId: destination.licenseId } });

  let attachmentCount = 0;
  if (created) {
    const attachments = await tx.attachment.findMany({ where: { companyId: sourceCompanyId, refModule: "EMPLOYEE", refId: employee.id } });
    for (const attachment of attachments) {
      const { id, createdAt, ...data } = attachment;
      await tx.attachment.create({ data: { ...data, companyId: destination.companyId, branchId: null, refId: target.id, entityId: attachment.entityId === employee.id ? target.id : attachment.entityId } });
    }
    attachmentCount = attachments.length;
  }
  return { sourceEmployeeId: employee.id, targetEmployeeId: target.id, employeeNumber: employee.employeeNumber, nameAr: employee.nameAr, destination: destination.label, created, attachments: attachmentCount };
}

async function main() {
  const workPermitLicenseIds = Object.keys(destinations);
  const [employees, targetLicenses] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: sourceCompanyId, workPermitLicenseId: { in: workPermitLicenseIds } }, orderBy: { employeeNumber: "asc" } }),
    prisma.license.findMany({ where: { id: { in: Object.values(destinations).map((item) => item.licenseId) } }, select: { id: true, companyId: true } }),
  ]);
  if (targetLicenses.length !== Object.keys(destinations).length) throw new Error("One or more target license copies are missing; no employees were copied.");
  for (const destination of Object.values(destinations)) if (!targetLicenses.some((license) => license.id === destination.licenseId && license.companyId === destination.companyId)) throw new Error("A target license does not belong to its target company; no employees were copied.");

  const copied = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const employee of employees) rows.push(await copyEmployee(tx, employee));
    return rows;
  }, { timeout: 120000 });

  const verification = await Promise.all(Object.entries(destinations).map(async ([sourceWorkPermitId, destination]) => ({
    destination: destination.label,
    sourceEmployees: await prisma.employee.count({ where: { companyId: sourceCompanyId, workPermitLicenseId: sourceWorkPermitId } }),
    copiedEmployees: await prisma.employee.count({ where: { companyId: destination.companyId, licenseId: destination.licenseId, residencyLicenseId: destination.licenseId, workPermitLicenseId: destination.licenseId } }),
  })));
  console.log(JSON.stringify({ success: true, copied: copied.length, rows: copied, verification }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
