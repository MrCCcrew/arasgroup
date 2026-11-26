const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const licenseIds = [
  "cmqzlj4m80003l1qoj5kqzoqi", "cmqzlj4nd0007l1qo19g0ok7h", "cmqy4ucto0011l143chnhwhse", "cmqzlj4mg0005l1qouqwtjqog", "cmqy4ucu00013l1439hm946ci",
];
(async () => {
  const employees = await prisma.employee.findMany({
    where: { companyId: "co-silver-valley", OR: [{ licenseId: { in: licenseIds } }, { residencyLicenseId: { in: licenseIds } }, { workPermitLicenseId: { in: licenseIds } }] },
    select: { id: true, employeeNumber: true, nameAr: true, licenseId: true, residencyLicenseId: true, workPermitLicenseId: true, positionId: true, civilId: true },
    orderBy: { employeeNumber: "asc" },
  });
  console.log(JSON.stringify({ count: employees.length, employees }, null, 2));
})().catch(console.error).finally(() => prisma.$disconnect());
