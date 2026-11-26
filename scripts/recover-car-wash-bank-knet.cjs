/*
 * One-time recovery for the erroneous 2026-11-14 bank-KNET import.
 * Reads the MySQL binary log before writing anything, restores the operational
 * KNET total/revenue/settlement transaction exactly, and moves imported bank
 * totals to the separate reconciliation table.
 * Usage: node scripts/recover-car-wash-bank-knet.cjs --apply
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BINLOG_DIR = "/var/lib/mysql";

function fieldMap(block) {
  const fields = new Map();
  for (const match of block.matchAll(/^###\s+@(\d+)=(.*)$/gm)) fields.set(Number(match[1]), match[2].trim());
  return fields;
}

function stringValue(value) {
  if (!value || value === "NULL") return null;
  const match = value.match(/^'(.*)'\s+\/\*/);
  return match ? match[1].replace(/\\'/g, "'") : value.split(" ")[0];
}

function decimalValue(value) {
  return Number(String(value).split(" ")[0]);
}

function eventBlocks(log, table, kind) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const verb = kind === "UPDATE" ? "UPDATE" : `${kind} FROM`;
  const re = new RegExp("### " + verb + " `rashidgroup_db`\\.`" + escapedTable + "`([\\s\\S]*?)(?=\\n# at|\\nCOMMIT|$)", "g");
  return [...log.matchAll(re)].map((match) => match[1]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  // Only the active binary log contains the still-unrecovered legacy rows.
  // Scanning historic logs together would exceed Node's string limit.
  const binlogs = fs.readdirSync(BINLOG_DIR).filter((file) => /^binlog\.\d+$/.test(file)).sort().slice(-1).map((file) => `${BINLOG_DIR}/${file}`);
  const log = execFileSync("mysqlbinlog", ["--base64-output=DECODE-ROWS", "-vv", ...binlogs], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  const legacyBankRows = await prisma.knetTransaction.findMany({
    where: { transactionRef: { startsWith: "BANKKNET:" } },
    select: { id: true, operationId: true, amount: true, date: true, transactionRef: true },
  });
  const affectedIds = new Set(legacyBankRows.map((row) => row.operationId));
  if (!affectedIds.size) throw new Error("No legacy bank-KNET rows found; refusing to change data.");

  const bankAmounts = new Map();
  for (const row of legacyBankRows) bankAmounts.set(row.operationId, (bankAmounts.get(row.operationId) ?? 0) + Number(row.amount));
  const oldTotals = new Map();
  for (const block of eventBlocks(log, "car_wash_daily_operations", "UPDATE")) {
    const [whereBlock, setBlock] = block.split("### SET");
    const before = fieldMap(whereBlock);
    const after = fieldMap(setBlock || "");
    const id = stringValue(before.get(1));
    if (!id || !affectedIds.has(id) || oldTotals.has(id)) continue;
    const oldKnet = decimalValue(before.get(7));
    const newKnet = decimalValue(after.get(7));
    if (Number.isFinite(oldKnet) && Number.isFinite(newKnet) && oldKnet !== newKnet && Math.abs(newKnet - bankAmounts.get(id)) < 0.001) oldTotals.set(id, oldKnet);
  }

  const deletedRevenues = [];
  for (const block of eventBlocks(log, "car_wash_revenues", "DELETE")) {
    const value = fieldMap(block);
    const operationId = stringValue(value.get(2));
    if (!operationId || !affectedIds.has(operationId) || decimalValue(value.get(3)) !== 2) continue;
    deletedRevenues.push({
      id: stringValue(value.get(1)), operationId, amount: decimalValue(value.get(4)), description: stringValue(value.get(5)),
      createdAt: stringValue(value.get(6)), date: stringValue(value.get(7)), paymentMethod: stringValue(value.get(8)),
      imageUrl: stringValue(value.get(9)), ocrRawText: stringValue(value.get(10)), transactionReference: stringValue(value.get(11)),
      source: stringValue(value.get(12)) || "ADMIN", createdById: stringValue(value.get(13)), createdByEmployeeId: stringValue(value.get(14)),
    });
  }

  const deletedTransactions = [];
  for (const block of eventBlocks(log, "knet_transactions", "DELETE")) {
    const value = fieldMap(block);
    const operationId = stringValue(value.get(2));
    if (!operationId || !affectedIds.has(operationId)) continue;
    deletedTransactions.push({
      id: stringValue(value.get(1)), operationId, amount: decimalValue(value.get(3)), transactionRef: stringValue(value.get(4)),
      date: stringValue(value.get(5)), settlementId: stringValue(value.get(6)), isSettled: decimalValue(value.get(7)) === 1,
      createdAt: stringValue(value.get(8)), cardType: stringValue(value.get(9)) || "KNET",
    });
  }

  const missing = [...affectedIds].filter((id) => !oldTotals.has(id));
  console.log(JSON.stringify({ apply, affected: affectedIds.size, recoveredTotals: oldTotals.size, originalRevenueRows: deletedRevenues.length, originalKnetRows: deletedTransactions.length, newBankOnlyOperations: missing }, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    for (const operationId of affectedIds) {
      const operation = await tx.carWashDailyOperation.findUniqueOrThrow({ where: { id: operationId }, select: { id: true, companyId: true, date: true, totalCash: true, totalExpenses: true } });
      const bankRows = legacyBankRows.filter((row) => row.operationId === operationId);
      const bankAmount = bankRows.reduce((sum, row) => sum + Number(row.amount), 0);
      const bankReference = bankRows.map((row) => row.transactionRef).filter(Boolean).join(" | ").slice(0, 191) || null;

      await tx.carWashBankKnetTransaction.upsert({
        where: { operationId_date: { operationId, date: operation.date } },
        create: { operationId, date: operation.date, amount: bankAmount, transactionRef: bankReference },
        update: { amount: bankAmount, transactionRef: bankReference },
      });
      await tx.carWashRevenue.deleteMany({ where: { operationId, description: "KNET bank statement" } });
      await tx.knetTransaction.deleteMany({ where: { operationId, transactionRef: { startsWith: "BANKKNET:" } } });
      await tx.journalEntry.updateMany({
        where: { companyId: operation.companyId, refModule: "car_wash", refId: operationId, type: "CAR_WASH_REVENUE", isDeleted: false },
        data: { isDeleted: true, deletedAt: now },
      });
      const restoredKnet = oldTotals.get(operationId) ?? 0;
      await tx.carWashDailyOperation.update({
        where: { id: operationId },
        data: { totalKnet: restoredKnet, netRevenue: Number(operation.totalCash) + restoredKnet - Number(operation.totalExpenses), journalEntryId: null, status: "OPEN" },
      });
    }

    for (const revenue of deletedRevenues) {
      // Historical user records may have been removed after the original entry.
      // Keep the financial record intact while avoiding a now-invalid FK.
      const { createdById, createdByEmployeeId, ...restoredRevenue } = revenue;
      await tx.carWashRevenue.upsert({ where: { id: revenue.id }, update: {}, create: { ...restoredRevenue, type: "KNET", date: new Date(revenue.date), createdAt: new Date(revenue.createdAt) } });
    }
    for (const transaction of deletedTransactions) {
      // The importer only removed unsettled rows. A stale settlement reference
      // may no longer exist, so restore it as an unsettled operational KNET row.
      const { settlementId, ...restoredTransaction } = transaction;
      await tx.knetTransaction.upsert({ where: { id: transaction.id }, update: {}, create: { ...restoredTransaction, settlementId: null, isSettled: false, date: new Date(transaction.date), createdAt: new Date(transaction.createdAt) } });
    }
  }, { timeout: 120000 });
  console.log("Recovery completed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
