const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const licenseId = "cmqzmphed000fl134vxob0va9";
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: {
      id: true,
      companyId: true,
      isMainLicense: true,
      _count: { select: { establishmentContracts: true } },
      establishmentContracts: {
        select: { isActive: true, _count: { select: { partners: true } } },
      },
    },
  });
  const models = [
    ["establishmentContracts", () => prisma.establishmentContract.count({ where: { licenseId } })],
    ["leaseContracts", () => prisma.leaseContract.count({ where: { licenseId } })],
    ["employerSignatureCert", () => prisma.employerSignatureCert.count({ where: { licenseId } })],
    ["rentReceipts", () => prisma.licenseRentReceipt.count({ where: { licenseId } })],
    ["importLicenseDoc", () => prisma.importLicenseDoc.count({ where: { licenseId } })],
    ["advertisingDetails", () => prisma.licenseAdvertisingDetails.count({ where: { licenseId } })],
    ["fireSafetyCert", () => prisma.licenseFireSafetyCert.count({ where: { licenseId } })],
    ["healthLicense", () => prisma.licenseHealthLicense.count({ where: { licenseId } })],
    ["trafficCert", () => prisma.licenseTrafficCert.count({ where: { licenseId } })],
    ["customsCert", () => prisma.licenseCustomsCert.count({ where: { licenseId } })],
    ["managerPOA", () => prisma.managerPOA.count({ where: { licenseId } })],
    ["workInjury", () => prisma.workInjuryInsurance.count({ where: { licenseId } })],
    ["annualBalances", () => prisma.licenseAnnualBalance.count({ where: { licenseId } })],
  ];
  const checks = {};
  for (const [name, run] of models) {
    try { await run(); checks[name] = "ok"; } catch { checks[name] = "unavailable"; }
  }
  console.log(JSON.stringify({
    found: Boolean(license),
    isMainLicense: license.isMainLicense,
    contracts: license._count.establishmentContracts,
    activeContracts: license.establishmentContracts.filter((contract) => contract.isActive).length,
    activePartners: license.establishmentContracts.filter((contract) => contract.isActive).reduce((sum, contract) => sum + contract._count.partners, 0),
    partners: license.establishmentContracts.reduce((sum, contract) => sum + contract._count.partners, 0),
    checks,
  }));
}

main().finally(() => prisma.$disconnect());
