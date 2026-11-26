const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const employee = await prisma.employee.update({
    where: { id: "cmsofndol01eil1bisd2pwk9u" },
    data: { type: "CAR_WASH_DRIVER" },
    select: { employeeNumber: true, nameAr: true, type: true, companyId: true },
  });
  console.log(JSON.stringify(employee));
}
main().catch(console.error).finally(() => prisma.$disconnect());
