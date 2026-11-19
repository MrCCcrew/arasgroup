const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const license = await prisma.license.findFirst({
    where: { licenseNumber: "2016/628" },
    select: {
      id: true,
      _count: { select: { establishmentContracts: true } },
      establishmentContracts: { select: { isActive: true, _count: { select: { partners: true } } } },
      employerSignatureCert: { select: { _count: { select: { signatories: true } } } },
    },
  });
  console.log(JSON.stringify({
    licenseFound: Boolean(license),
    establishmentContracts: license?._count.establishmentContracts ?? 0,
    activeEstablishmentContracts: license?.establishmentContracts.filter((contract) => contract.isActive).length ?? 0,
    partners: license?.establishmentContracts.reduce((total, contract) => total + contract._count.partners, 0) ?? 0,
    employerCertificate: Boolean(license?.employerSignatureCert),
    signatories: license?.employerSignatureCert?._count.signatories ?? 0,
  }));
}

main().finally(() => prisma.$disconnect());
