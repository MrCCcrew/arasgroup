/**
 * Migration script to populate date field in car_wash_revenues and car_wash_expenses
 * from their parent operation date
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Populating dates for car wash revenues and expenses...\n');

  // Get all operations with their revenues and expenses
  const operations = await prisma.carWashDailyOperation.findMany({
    include: {
      revenues: true,
      expenses: true,
    },
  });

  console.log(`Found ${operations.length} operations to process\n`);

  let revenuesUpdated = 0;
  let expensesUpdated = 0;

  for (const operation of operations) {
    // Update revenues that don't have a date
    for (const revenue of operation.revenues) {
      if (!revenue.date) {
        await prisma.carWashRevenue.update({
          where: { id: revenue.id },
          data: { date: operation.date },
        });
        revenuesUpdated++;
      }
    }

    // Update expenses that don't have a date
    for (const expense of operation.expenses) {
      if (!expense.date) {
        await prisma.carWashExpense.update({
          where: { id: expense.id },
          data: { date: operation.date },
        });
        expensesUpdated++;
      }
    }
  }

  console.log(`✅ Migration completed successfully!`);
  console.log(`   - Updated ${revenuesUpdated} revenues`);
  console.log(`   - Updated ${expensesUpdated} expenses\n`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
