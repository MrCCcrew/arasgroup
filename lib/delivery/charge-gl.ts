import { prisma } from "@/lib/db";
import { createDriverWalletChargeJE } from "@/lib/accounting/auto-entries";

const chargeDesc = (date: Date) => `تحصيل (أمانات طلبات) — ${date.toISOString().slice(0, 10)}`;

/**
 * يوفّق قيود التحصيل (CHARGE → مدين 1030 / دائن 2031) مع حركات المحفظة — النموذج (ب).
 *  - تحصيل بدون قيد → ينشئ قيد POSTED.
 *  - تحصيل قيمته اتغيّرت → يحدّث سطور القيد في مكانها (بدون قيد عكسي).
 *  - قيد تحصيل يتيم (التحصيل اتحذف/اتصفّر) → يخفيه (isDeleted).
 * idempotent. لو مرّرت driverIds، يقتصر التوفيق على سواقين محدّدين (للاستدعاء بعد كل حفظ).
 * لو حساب 2031 مش موجود، يرجّع skipped (الشركة مش مفعّلة للنموذج ب).
 */
export async function reconcileDriverChargeJEs(params: {
  companyId: string;
  userId: string;
  driverIds?: string[];
}): Promise<{ created: number; updated: number; removed: number; skipped: boolean }> {
  const { companyId, userId } = params;
  const driverIds = params.driverIds && params.driverIds.length > 0 ? [...new Set(params.driverIds)] : undefined;

  const custody = await prisma.chartOfAccount.findFirst({
    where: { companyId, code: "2031", type: "LIABILITY", isActive: true },
    select: { id: true },
  });
  if (!custody) return { created: 0, updated: 0, removed: 0, skipped: true };

  const charges = await prisma.driverWalletTransaction.findMany({
    where: {
      type: "CHARGE",
      driver: { employee: { companyId } },
      ...(driverIds ? { driverId: { in: driverIds } } : {}),
    },
    select: { id: true, driverId: true, amount: true, date: true, journalEntryId: true },
  });

  const chargeJEs = await prisma.journalEntry.findMany({
    where: {
      companyId,
      refModule: "delivery_charge",
      isDeleted: false,
      ...(driverIds ? { lines: { some: { driverId: { in: driverIds } } } } : {}),
    },
    select: { id: true, totalDebit: true },
  });
  const jeById = new Map(chargeJEs.map((je) => [je.id, je]));
  const referencedJeIds = new Set(charges.map((c) => c.journalEntryId).filter(Boolean) as string[]);

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const c of charges) {
    const amount = Number(c.amount);
    if (amount <= 0) continue;

    if (!c.journalEntryId || !jeById.has(c.journalEntryId)) {
      const je = await createDriverWalletChargeJE({
        companyId,
        userId,
        driverId: c.driverId,
        amount,
        date: c.date,
        refId: c.id,
        descriptionAr: chargeDesc(c.date),
      });
      if (je) {
        await prisma.driverWalletTransaction.update({ where: { id: c.id }, data: { journalEntryId: je.id } });
        created += 1;
      }
      continue;
    }

    const je = jeById.get(c.journalEntryId)!;
    if (Math.abs(Number(je.totalDebit) - amount) > 0.0005) {
      const full = await prisma.journalEntry.findUnique({ where: { id: c.journalEntryId }, include: { lines: true } });
      if (full && !full.isDeleted) {
        for (const line of full.lines) {
          await prisma.journalEntryLine.update({
            where: { id: line.id },
            data: { debit: Number(line.debit) > 0 ? amount : 0, credit: Number(line.credit) > 0 ? amount : 0 },
          });
        }
        await prisma.journalEntry.update({ where: { id: c.journalEntryId }, data: { totalDebit: amount, totalCredit: amount } });
        updated += 1;
      }
    }
  }

  for (const je of chargeJEs) {
    if (!referencedJeIds.has(je.id)) {
      await prisma.journalEntry.update({ where: { id: je.id }, data: { isDeleted: true, deletedAt: new Date() } });
      removed += 1;
    }
  }

  return { created, updated, removed, skipped: false };
}
