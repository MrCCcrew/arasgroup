import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const schema = z.object({
  companyId: z.string().min(1),
  sourceAccountId: z.string().min(1),
  destinationAccountId: z.string().min(1),
  journalType: z.string().optional(),
  side: z.enum(["DEBIT", "CREDIT"]).optional(),
  apply: z.boolean().default(false),
});

/**
 * نقل/إعادة تصنيف حركات حساب: يحوّل كل أسطر القيود المرتبطة بحساب المصدر إلى
 * حساب الوجهة (لا يغيّر المبالغ — مجرد تغيير الحساب). preview (apply:false) يرجّع
 * العدد والمجاميع للمراجعة قبل التنفيذ، ثم apply:true ينفّذ داخل معاملة مع تسجيل في سجل العمليات.
 */
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { companyId, sourceAccountId, destinationAccountId, journalType, side, apply } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", { companyId });
    if (permissionError) return permissionError;

    if (sourceAccountId === destinationAccountId) {
      return NextResponse.json({ success: false, error: "حساب المصدر والوجهة يجب أن يكونا مختلفين" }, { status: 400 });
    }

    const [source, destination] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { id: sourceAccountId, companyId }, select: { id: true, code: true, nameAr: true } }),
      prisma.chartOfAccount.findFirst({ where: { id: destinationAccountId, companyId }, select: { id: true, code: true, nameAr: true, isHeader: true } }),
    ]);
    if (!source) {
      return NextResponse.json({ success: false, error: "حساب المصدر غير موجود" }, { status: 400 });
    }
    if (!destination) {
      return NextResponse.json({ success: false, error: "حساب الوجهة غير موجود" }, { status: 400 });
    }
    if (destination.isHeader) {
      return NextResponse.json({ success: false, error: "لا يمكن النقل إلى حساب رئيسي — اختر حساباً فرعياً يقبل القيود" }, { status: 400 });
    }

    // الفلتر المطبَّق (نوع القيد + الطرف مدين/دائن) — يحدّد ما سيُنقل فعلاً
    const where = {
      accountId: sourceAccountId,
      journalEntry: { companyId, isDeleted: false, ...(journalType ? { type: journalType as never } : {}) },
      ...(side === "DEBIT" ? { debit: { gt: 0 } } : side === "CREDIT" ? { credit: { gt: 0 } } : {}),
    };
    const agg = await prisma.journalEntryLine.aggregate({
      where,
      _count: true,
      _sum: { debit: true, credit: true },
    });

    const summary = {
      source: { code: source.code, nameAr: source.nameAr },
      destination: { code: destination.code, nameAr: destination.nameAr },
      lines: agg._count,
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    };

    if (!apply) {
      // تفصيل كل حركات حساب المصدر حسب نوع القيد + الطرف (بغضّ النظر عن الفلتر)
      // عشان المستخدم يشوف كل اللي على الحساب ويحدّد اللي يرجّعه بدقّة.
      const allLines = await prisma.journalEntryLine.findMany({
        where: { accountId: sourceAccountId, journalEntry: { companyId, isDeleted: false } },
        select: { debit: true, credit: true, journalEntry: { select: { type: true } } },
      });
      const map = new Map<string, { type: string; side: "DEBIT" | "CREDIT"; lines: number; amount: number }>();
      for (const line of allLines) {
        const isDebit = Number(line.debit) > 0;
        const lineSide: "DEBIT" | "CREDIT" = isDebit ? "DEBIT" : "CREDIT";
        const type = line.journalEntry.type ?? "GENERAL";
        const key = `${type}|${lineSide}`;
        const entry = map.get(key) ?? { type, side: lineSide, lines: 0, amount: 0 };
        entry.lines += 1;
        entry.amount += isDebit ? Number(line.debit) : Number(line.credit);
        map.set(key, entry);
      }
      const breakdown = [...map.values()].sort((a, b) => (a.type === b.type ? a.side.localeCompare(b.side) : a.type.localeCompare(b.type)));
      return NextResponse.json({ success: true, preview: true, ...summary, breakdown });
    }

    if (agg._count === 0) {
      return NextResponse.json({ success: true, moved: 0, ...summary });
    }

    let moved = 0;
    await prisma.$transaction(async (tx) => {
      const result = await tx.journalEntryLine.updateMany({
        where,
        data: { accountId: destinationAccountId },
      });
      moved = result.count;

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "RECLASSIFY_ACCOUNT_LINES",
          module: "accounting",
          resourceId: sourceAccountId,
          resourceType: "ChartOfAccount",
          oldValues: { accountId: sourceAccountId, code: source.code, journalType: journalType ?? null, side: side ?? null },
          newValues: { accountId: destinationAccountId, code: destination.code, movedLines: moved },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true, moved, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في نقل الحركات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
