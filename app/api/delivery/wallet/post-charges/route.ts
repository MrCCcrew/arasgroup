import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { createDriverWalletChargeJE } from "@/lib/accounting/auto-entries";

const schema = z.object({
  companyId: z.string().min(1),
  apply: z.boolean().default(false),
});

const chargeDesc = (date: Date) => `تحصيل (أمانات طلبات) — ${date.toISOString().slice(0, 10)}`;

/**
 * ترحيل التحصيلات لحساب أمانات طلبات (2031) — النموذج (ب).
 * يوفّق كل حركات التحصيل (CHARGE) مع قيود الأستاذ:
 *  - تحصيل بدون قيد  → ينشئ قيد POSTED (مدين 1030 / دائن 2031).
 *  - تحصيل قيمته اتغيّرت → يحدّث سطور القيد في مكانها (بدون قيد عكسي).
 *  - قيد تحصيل يتيم (التحصيل اتحذف) → يخفيه (isDeleted).
 * idempotent — يُعاد تشغيله بأمان. preview (apply:false) يرجّع الأعداد قبل التنفيذ.
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
    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", { companyId });
    if (permissionError) return permissionError;

    const custody = await prisma.chartOfAccount.findFirst({
      where: { companyId, code: "2031", type: "LIABILITY", isActive: true },
      select: { id: true },
    });
    if (!custody) {
      return NextResponse.json(
        { success: false, error: "حساب أمانات لشركة طلبات (2031، التزامات) غير موجود — أنشئه أولاً" },
        { status: 400 },
      );
    }

    // كل حركات التحصيل للشركة
    const charges = await prisma.driverWalletTransaction.findMany({
      where: { type: "CHARGE", driver: { employee: { companyId } } },
      select: { id: true, driverId: true, amount: true, date: true, journalEntryId: true },
    });

    // قيود التحصيل الحالية على الأستاذ (لاكتشاف اليتيم)
    const chargeJEs = await prisma.journalEntry.findMany({
      where: { companyId, refModule: "delivery_charge", isDeleted: false },
      select: { id: true, totalDebit: true },
    });
    const jeById = new Map(chargeJEs.map((je) => [je.id, je]));
    const referencedJeIds = new Set(charges.map((c) => c.journalEntryId).filter(Boolean) as string[]);

    let toCreate = 0;
    let toUpdate = 0;
    const orphans = chargeJEs.filter((je) => !referencedJeIds.has(je.id)).map((je) => je.id);

    for (const c of charges) {
      const amount = Number(c.amount);
      if (amount <= 0) continue;
      if (!c.journalEntryId || !jeById.has(c.journalEntryId)) {
        toCreate += 1;
      } else {
        const je = jeById.get(c.journalEntryId)!;
        if (Math.abs(Number(je.totalDebit) - amount) > 0.0005) toUpdate += 1;
      }
    }

    if (!apply) {
      return NextResponse.json({
        success: true,
        preview: true,
        created: toCreate,
        updated: toUpdate,
        removed: orphans.length,
      });
    }

    let created = 0;
    let updated = 0;
    let removed = 0;

    for (const c of charges) {
      const amount = Number(c.amount);
      if (amount <= 0) continue;

      // إنشاء قيد جديد
      if (!c.journalEntryId || !jeById.has(c.journalEntryId)) {
        const je = await createDriverWalletChargeJE({
          companyId,
          userId: session.id,
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

      // تحديث القيمة في مكانها لو اتغيّرت
      const je = jeById.get(c.journalEntryId)!;
      if (Math.abs(Number(je.totalDebit) - amount) > 0.0005) {
        const full = await prisma.journalEntry.findUnique({
          where: { id: c.journalEntryId },
          include: { lines: true },
        });
        if (full && !full.isDeleted) {
          for (const line of full.lines) {
            await prisma.journalEntryLine.update({
              where: { id: line.id },
              data: {
                debit: Number(line.debit) > 0 ? amount : 0,
                credit: Number(line.credit) > 0 ? amount : 0,
              },
            });
          }
          await prisma.journalEntry.update({
            where: { id: c.journalEntryId },
            data: { totalDebit: amount, totalCredit: amount },
          });
          updated += 1;
        }
      }
    }

    // حذف قيود التحصيل اليتيمة (التحصيل اتحذف)
    for (const jeId of orphans) {
      await prisma.journalEntry.update({ where: { id: jeId }, data: { isDeleted: true, deletedAt: new Date() } });
      removed += 1;
    }

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "POST_WALLET_CHARGES",
        module: "delivery",
        resourceId: companyId,
        resourceType: "DriverWalletTransaction",
        newValues: { created, updated, removed },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true, created, updated, removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في ترحيل التحصيلات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
