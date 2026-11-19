const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const companies = await prisma.company.findMany({ select: { id: true, nameAr: true } });
  const ids = ["cmrjqd9jd00dbl1ehqefzgvok", "cmqr2gbj4001vl159k5dy4o2f", "cmrjqa5o400d9l1ehkli90o67", "cmqzpqfon0001l1m7svaaxr43", "cmqzlj4oj000jl1qovugcvaky"];
  const licenses = await prisma.license.findMany({ where: { id: { in: ids } }, select: { id: true, companyId: true, licenseNumber: true, commercialNameAr: true, isMainLicense: true, mainLicenseId: true, _count: { select: { documentVersions: true, establishmentContracts: true, leaseContracts: true, violations: true, partnerCivilIds: true, workInjuryInsurances: true, annualBalances: true } } } });
  console.log(JSON.stringify(licenses, null, 2));
})().finally(() => prisma.$disconnect());
