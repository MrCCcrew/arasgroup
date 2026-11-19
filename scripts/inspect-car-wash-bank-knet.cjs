const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const imported = await prisma.knetTransaction.findMany({
    where: { transactionRef: { startsWith: "BANKKNET:" } },
    include: {
      operation: { include: { vehicle: { select: { code: true, nameAr: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const operationIds = [...new Set(imported.map((item) => item.operationId))];
  const entries = operationIds.length
    ? await prisma.journalEntry.findMany({
      where: { refModule: "car_wash", refId: { in: operationIds }, type: "CAR_WASH_REVENUE" },
      include: { lines: { include: { account: { select: { code: true } } } } },
      orderBy: { createdAt: "asc" },
    })
    : [];
  const byOperation = new Map();
  for (const entry of entries) {
    const list = byOperation.get(entry.refId) || [];
    list.push({
      id: entry.id,
      createdAt: entry.createdAt,
      deletedAt: entry.deletedAt,
      status: entry.status,
      isDeleted: entry.isDeleted,
      totalDebit: entry.totalDebit.toString(),
      knet: entry.lines.filter((line) => line.account.code === "1020").reduce((sum, line) => sum + Number(line.debit), 0),
    });
    byOperation.set(entry.refId, list);
  }

  console.log(JSON.stringify(imported.map((item) => ({
    operationId: item.operationId,
    companyId: item.operation.companyId,
    vehicle: item.operation.vehicle,
    date: item.operation.date,
    currentTotalKnet: item.operation.totalKnet.toString(),
    bankAmount: item.amount.toString(),
    bankCreatedAt: item.createdAt,
    journalEntries: byOperation.get(item.operationId) || [],
  })), null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
