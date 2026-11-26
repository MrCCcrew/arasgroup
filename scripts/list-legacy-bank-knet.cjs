const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.knetTransaction.findMany({
    where: { transactionRef: { startsWith: "BANKKNET:" } },
    select: { id: true, operationId: true, amount: true, date: true, createdAt: true, operation: { select: { companyId: true, vehicleId: true, totalKnet: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(rows.map((row) => ({ ...row, amount: row.amount.toString(), operation: { ...row.operation, totalKnet: row.operation.totalKnet.toString() } })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
