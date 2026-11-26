const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sourceCompanyId = "co-silver-valley";
const licenseCopies = {
  cmqzlj4m80003l1qoj5kqzoqi: { companyId: "cmwnu3q5r00k5l1l2l6k3qh9j", copyId: "cmwquhvq30002l1lmxbtksvzq" },
  cmqzlj4nd0007l1qo19g0ok7h: { companyId: "cmwnu188j00hhl1l2v8d9u1r1", copyId: "cmwquhvs3000ll1lmscfo7sv3" },
  cmqy4ucto0011l143chnhwhse: { companyId: "cmwntzjce00epl1l2okp6d2xw", copyId: "cmwquhvtq0016l1lmt290sxvt" },
  cmqzlj4mg0005l1qouqwtjqog: { companyId: "cmwntypkt00bxl1l2igkz259b", copyId: "cmwquhvv0001ll1lmg39fl9j3" },
  cmqy4ucu00013l1439hm946ci: { companyId: "cmwntxibv0095l1l2p0otp121", copyId: "cmwquhvw30026l1lm9x5uprpe" },
};

async function dependencies(tx, employeeId) {
  const [salaryPayments, salaryItems, advances, tickets, eos, leavePay, custodies, expenses, vehicles, notifications, attachments] = await Promise.all([
    tx.salaryPayment.count({ where: { employeeId } }), tx.salaryItem.count({ where: { employeeId } }),
    tx.employeeAdvance.count({ where: { employeeId } }), tx.employeeTicket.count({ where: { employeeId } }),
    tx.endOfServiceCalc.count({ where: { employeeId } }), tx.leavePayCalc.count({ where: { employeeId } }),
    tx.assetCustody.count({ where: { employeeId } }), tx.expense.count({ where: { employeeId } }),
    tx.vehicle.count({ where: { assignedEmployeeId: employeeId } }), tx.notification.count({ where: { employeeId } }),
    tx.attachment.count({ where: { refModule: "EMPLOYEE", refId: employeeId } }),
  ]);
  return { salaryPayments, salaryItems, advances, tickets, eos, leavePay, custodies, expenses, vehicles, notifications, attachments };
}

async function main() {
  const sourceWorkPermitIds = Object.keys(licenseCopies);
  const employees = await prisma.employee.findMany({ where: { companyId: sourceCompanyId, workPermitLicenseId: { in: sourceWorkPermitIds } } });
  const results = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const employee of employees) {
      const work = licenseCopies[employee.workPermitLicenseId];
      const residencyCopy = employee.residencyLicenseId ? licenseCopies[employee.residencyLicenseId]?.copyId : null;
      const duplicate = employee.civilId
        ? await tx.employee.findFirst({ where: { companyId: work.companyId, civilId: employee.civilId } })
        : null;

      if (!duplicate) throw new Error(`Expected copied employee is missing for ${employee.id}`);
      const linked = await dependencies(tx, duplicate.id);
      if (Object.values(linked).some((count) => count !== 0)) throw new Error(`Copied employee ${duplicate.id} has dependent records and was not deleted: ${JSON.stringify(linked)}`);

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          // The original Employee stays the sole master record. Licenses tell
          // us who sponsors residency and where the employee works.
          licenseId: work.copyId,
          workPermitLicenseId: work.copyId,
          residencyLicenseId: residencyCopy ?? employee.residencyLicenseId,
        },
      });
      for (const licenseId of new Set([work.copyId, residencyCopy].filter(Boolean))) {
        await tx.employeeLicenseAssignment.upsert({
          where: { employeeId_licenseId: { employeeId: employee.id, licenseId } },
          create: { employeeId: employee.id, licenseId },
          update: {},
        });
      }
      await tx.employee.delete({ where: { id: duplicate.id } });
      rows.push({ employeeNumber: employee.employeeNumber, nameAr: employee.nameAr, masterEmployeeId: employee.id, removedDuplicateId: duplicate.id, workingLicenseId: work.copyId, residencyLicenseId: residencyCopy ?? employee.residencyLicenseId });
    }
    return rows;
  }, { timeout: 120000 });

  const verification = await Promise.all(Object.entries(licenseCopies).map(async ([sourceLicenseId, target]) => ({
    sourceLicenseId,
    sharedEmployeesWorkingThere: await prisma.employee.count({ where: { companyId: sourceCompanyId, workPermitLicenseId: target.copyId, licenseId: target.copyId } }),
    duplicateEmployeesRemaining: await prisma.employee.count({ where: { companyId: target.companyId, workPermitLicenseId: target.copyId } }),
    sponsoredThere: await prisma.employee.count({ where: { companyId: sourceCompanyId, residencyLicenseId: target.copyId } }),
  })));
  console.log(JSON.stringify({ success: true, normalized: results.length, rows: results, verification }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
