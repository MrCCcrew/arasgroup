import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { recomputeDriverWalletStates } from "@/lib/delivery/wallet-state";

const schema = z.object({
  companyId: z.string().min(1),
  apply: z.boolean().optional().default(false),
});

/**
 * إزالة حركات التحصيل (CHARGE) المكرّرة في محافظ السائقين الناتجة عن إعادة حفظ
 * الطلبات اليومية قبل إصلاح المزامنة. لكل (سائق + طلب يومي/تاريخ) نُبقي حركة واحدة
 * فقط ونحذف المكرّر، ثم نعيد حساب الأرصدة لتطابق الطلبات اليومية.
 * apply=false يرجّع معاينة فقط دون أي تعديل.
 */
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { companyId, apply } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // كل حركات التحصيل لسائقي الشركة
    const charges = await prisma.driverWalletTransaction.findMany({
      where: { type: "CHARGE", driver: { employee: { companyId } } },
      select: { id: true, driverId: true, contractId: true, date: true, amount: true, dailyOrderId: true, createdAt: true },
    });

    // المفتاح: سائق + (طلب يومي إن وُجد، وإلا عقد+يوم). كل مجموعة المفترض حركة واحدة.
    const groups = new Map<string, typeof charges>();
    for (const c of charges) {
      const dayKey = c.dailyOrderId ?? `d:${c.contractId ?? ""}|${c.date.toISOString().slice(0, 10)}`;
      const key = `${c.driverId}|${dayKey}`;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }

    const toDelete: string[] = [];
    const affectedDrivers = new Set<string>();
    let duplicateAmount = 0;

    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;
      // نُبقي الأفضل: من له dailyOrderId ثم الأحدث؛ ونحذف الباقي
      arr.sort((a, b) => {
        if (!!b.dailyOrderId !== !!a.dailyOrderId) return b.dailyOrderId ? 1 : -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      for (const dup of arr.slice(1)) {
        toDelete.push(dup.id);
        duplicateAmount += Number(dup.amount);
        affectedDrivers.add(dup.driverId);
      }
    }

    if (!apply) {
      return NextResponse.json({
        success: true,
        preview: true,
        duplicates: toDelete.length,
        affectedDrivers: affectedDrivers.size,
        duplicateAmount,
      });
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, removed: 0, affectedDrivers: 0 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverWalletTransaction.deleteMany({ where: { id: { in: toDelete } } });
      await recomputeDriverWalletStates(tx, affectedDrivers);
    });

    return NextResponse.json({ success: true, removed: toDelete.length, affectedDrivers: affectedDrivers.size, duplicateAmount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إزالة الحركات المكرّرة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
