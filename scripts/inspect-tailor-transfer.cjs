const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sourceCompanyId = "co-silver-valley";
const tokens = ["لسيانو", "فينوس", "الجدي", "اوحد"];
const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0621-\u064Aa-zA-Z0-9]/g, "");
const matches = (value) => tokens.some((token) => normalize(value).includes(normalize(token)));

async function main() {
  const companies = await prisma.company.findMany({
    where: {},
    select: { id: true, nameAr: true, type: true, isActive: true, _count: { select: { licenses: true, employees: true } } },
  });
  const allSourceLicenses = await prisma.license.findMany({
    where: { companyId: sourceCompanyId },
    select: {
      id: true, commercialNameAr: true, licenseNumber: true, isMainLicense: true, mainLicenseId: true,
      _count: { select: { documentVersions: true, establishmentContracts: true, leaseContracts: true, partnerCivilIds: true, violations: true, workInjuryInsurances: true, annualBalances: true, employees: true, employeeAssignments: true } },
    },
  });
  const sourceLicenses = allSourceLicenses.filter((license) => matches(license.commercialNameAr));
  const directEmployees = await prisma.employee.findMany({
    where: { companyId: sourceCompanyId, licenseId: { in: sourceLicenses.map((license) => license.id) } },
    select: { id: true, employeeNumber: true, nameAr: true, licenseId: true },
  });
  const assignments = await prisma.employeeLicenseAssignment.findMany({ where: { licenseId: { in: sourceLicenses.map((license) => license.id) } }, include: { employee: { select: { id: true, employeeNumber: true, nameAr: true, companyId: true, licenseId: true } } } });
  console.log(JSON.stringify({ companies: companies.filter((company) => matches(company.nameAr)), sourceLicenses, directEmployees, assignments }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
