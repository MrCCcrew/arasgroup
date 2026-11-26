const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sourceCompanyId = "co-silver-valley";
const moves = [
  { licenseId: "cmqzlj4m80003l1qoj5kqzoqi", targetCompanyId: "cmwnu3q5r00k5l1l2l6k3qh9j", name: "خياط لسيانو لأقمشة الرجال" },
  { licenseId: "cmqzlj4nd0007l1qo19g0ok7h", targetCompanyId: "cmwnu188j00hhl1l2v8d9u1r1", name: "خياط لسيانو المشتركه للرجال" },
  { licenseId: "cmqy4ucto0011l143chnhwhse", targetCompanyId: "cmwntzjce00epl1l2okp6d2xw", name: "خياط الرجل فينوس للرجال" },
  { licenseId: "cmqzlj4mg0005l1qouqwtjqog", targetCompanyId: "cmwntypkt00bxl1l2igkz259b", name: "خياط الجدي المشتركه للرجال" },
  { licenseId: "cmqy4ucu00013l1439hm946ci", targetCompanyId: "cmwntxibv0095l1l2p0otp121", name: "خياط الاوحد العربي للرجال" },
];

async function main() {
  const licenseIds = moves.map((move) => move.licenseId);
  const targetIds = moves.map((move) => move.targetCompanyId);
  const [licenses, targets, targetLicenseCount] = await Promise.all([
    prisma.license.findMany({ where: { id: { in: licenseIds } }, select: { id: true, companyId: true, commercialNameAr: true } }),
    prisma.company.findMany({ where: { id: { in: targetIds }, isActive: true }, select: { id: true, nameAr: true } }),
    prisma.license.count({ where: { companyId: { in: targetIds } } }),
  ]);
  if (licenses.length !== moves.length || licenses.some((license) => license.companyId !== sourceCompanyId)) throw new Error("One or more source licenses are unavailable or no longer belong to Silver Valley");
  if (targets.length !== moves.length) throw new Error("One or more target companies are unavailable or inactive");
  if (targetLicenseCount !== 0) throw new Error("At least one target company already has licenses; aborting to prevent duplicate transfer");

  const directEmployees = await prisma.employee.findMany({ where: { companyId: sourceCompanyId, licenseId: { in: licenseIds } }, select: { id: true } });
  const assignedEmployees = await prisma.employeeLicenseAssignment.findMany({ where: { licenseId: { in: licenseIds }, employee: { companyId: sourceCompanyId } }, select: { employeeId: true, licenseId: true } });
  const employeeIdsByLicense = new Map(licenseIds.map((licenseId) => [licenseId, new Set()]));
  for (const employee of directEmployees) {
    const record = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id }, select: { licenseId: true } });
    if (record.licenseId) employeeIdsByLicense.get(record.licenseId)?.add(employee.id);
  }
  for (const assignment of assignedEmployees) employeeIdsByLicense.get(assignment.licenseId)?.add(assignment.employeeId);

  const result = await prisma.$transaction(async (tx) => {
    const moved = [];
    for (const move of moves) {
      const employeeIds = [...(employeeIdsByLicense.get(move.licenseId) || [])];
      const licenseAttachments = await tx.attachment.updateMany({ where: { companyId: sourceCompanyId, refModule: "LICENSE", refId: move.licenseId }, data: { companyId: move.targetCompanyId } });
      const employeeAttachments = employeeIds.length ? await tx.attachment.updateMany({ where: { companyId: sourceCompanyId, refModule: "EMPLOYEE", refId: { in: employeeIds } }, data: { companyId: move.targetCompanyId } }) : { count: 0 };
      const licenseNotifications = await tx.notification.updateMany({ where: { companyId: sourceCompanyId, OR: [{ licenseId: move.licenseId }, { refId: move.licenseId }, { entityId: move.licenseId }] }, data: { companyId: move.targetCompanyId } });
      const employeeNotifications = employeeIds.length ? await tx.notification.updateMany({ where: { companyId: sourceCompanyId, employeeId: { in: employeeIds } }, data: { companyId: move.targetCompanyId } }) : { count: 0 };
      const employees = employeeIds.length ? await tx.employee.updateMany({ where: { companyId: sourceCompanyId, id: { in: employeeIds } }, data: { companyId: move.targetCompanyId, branchId: null, licenseId: move.licenseId } }) : { count: 0 };
      await tx.license.update({ where: { id: move.licenseId }, data: { companyId: move.targetCompanyId, branchId: null, isMainLicense: true, mainLicenseId: null } });
      moved.push({ name: move.name, licenseId: move.licenseId, employees: employees.count, licenseAttachments: licenseAttachments.count, employeeAttachments: employeeAttachments.count, licenseNotifications: licenseNotifications.count, employeeNotifications: employeeNotifications.count });
    }
    return moved;
  });

  const verification = await Promise.all(moves.map(async (move) => ({
    name: move.name,
    targetLicenses: await prisma.license.count({ where: { id: move.licenseId, companyId: move.targetCompanyId, isMainLicense: true, mainLicenseId: null } }),
    sourceLicenses: await prisma.license.count({ where: { id: move.licenseId, companyId: sourceCompanyId } }),
    targetEmployees: await prisma.employee.count({ where: { companyId: move.targetCompanyId, licenseId: move.licenseId } }),
  })));
  console.log(JSON.stringify({ success: true, moved: result, verification }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
