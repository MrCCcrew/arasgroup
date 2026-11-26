const { PrismaClient } = require("@prisma/client");

const [companyId, percentText, dateText] = process.argv.slice(2);
const percent = Number(percentText);
if (!companyId || !Number.isFinite(percent) || percent < 0 || percent >= 100 || !dateText) {
  throw new Error("Usage: node scripts/set-retail-average-margin.cjs <companyId> <marginPercent> <YYYY-MM-DD>");
}

const prisma = new PrismaClient();
prisma.company.update({
  where: { id: companyId },
  data: {
    retailAverageGrossMargin: percent,
    retailAverageMarginAsOf: new Date(`${dateText}T00:00:00.000Z`),
  },
  select: { id: true, nameAr: true, retailAverageGrossMargin: true, retailAverageMarginAsOf: true },
}).then((company) => {
  console.log(JSON.stringify(company));
}).finally(() => prisma.$disconnect());
