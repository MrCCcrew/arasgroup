const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const name = process.argv[2] || "";

prisma.company.findMany({
  where: { nameAr: { contains: name } },
  select: { id: true, nameAr: true, type: true },
}).then((companies) => {
  console.log(JSON.stringify(companies));
}).finally(() => prisma.$disconnect());
