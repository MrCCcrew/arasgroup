const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const companyId = "co-bergen-carwash";

async function main() {
  const [employee, drivers] = await Promise.all([
    prisma.employee.findFirst({ where: { companyId, employeeNumber: "3253" } }),
    prisma.employee.findMany({ where: { companyId, type: "CAR_WASH_DRIVER" }, take: 5, orderBy: { createdAt: "asc" } }),
  ]);
  console.log(JSON.stringify({ employee, drivers }, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
