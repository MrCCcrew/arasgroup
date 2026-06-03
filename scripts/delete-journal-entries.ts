import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteJournalEntries() {
  try {
    const result = await prisma.journalEntry.updateMany({
      where: {
        number: {
          in: ['QY-2026-0001', 'QY-2026-0002']
        }
      },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    console.log(`✅ تم حذف ${result.count} قيد محاسبي بنجاح`);
    console.log('القيود المحذوفة: QY-2026-0001, QY-2026-0002');

    // التحقق من القيود المحذوفة
    const deletedEntries = await prisma.journalEntry.findMany({
      where: {
        number: {
          in: ['QY-2026-0001', 'QY-2026-0002']
        }
      },
      select: {
        number: true,
        isDeleted: true,
        deletedAt: true,
        descriptionAr: true
      }
    });

    console.log('\nتفاصيل القيود المحذوفة:');
    console.log(deletedEntries);

  } catch (error) {
    console.error('❌ خطأ في حذف القيود:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteJournalEntries();
