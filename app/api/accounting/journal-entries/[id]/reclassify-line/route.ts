import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const schema = z.object({
  lineId: z.string().min(1),
  destinationAccountId: z.string().min(1),
});

/**
 * نقل سطر واحد من قيد إلى حساب آخر (تغيير الحساب فقط — المبلغ ومدين/دائن زي ما هما).
 * مفيد لتصحيح حساب سطر معيّن (مثلاً نقل الطرف البنكي لمصروف من الوطني إلى التوريدات)
 * من غير ما يتأثّر باقي القيود على نفس الحساب.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { lineId, destinationAccountId } = parsed.data;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, companyId: true },
    });
    if (!entry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, entry.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", { companyId: entry.companyId });
    if (permissionError) return permissionError;

    const line = await prisma.journalEntryLine.findFirst({
      where: { id: lineId, journalEntryId: id },
      select: { id: true, accountId: true },
    });
    if (!line) {
      return NextResponse.json({ success: false, error: "السطر غير موجود في هذا القيد" }, { status: 404 });
    }

    const destination = await prisma.chartOfAccount.findFirst({
      where: { id: destinationAccountId, companyId: entry.companyId },
      select: { id: true, code: true, isHeader: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      return NextResponse.json({ success: false, error: "حساب الوجهة غير موجود" }, { status: 400 });
    }
    if (destination.isHeader) {
      return NextResponse.json({ success: false, error: "لا يمكن النقل إلى حساب رئيسي — اختر حساباً فرعياً" }, { status: 400 });
    }
    if (destination.id === line.accountId) {
      return NextResponse.json({ success: false, error: "السطر بالفعل على هذا الحساب" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.update({
        where: { id: lineId },
        data: { accountId: destinationAccountId },
      });
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "RECLASSIFY_LINE",
          module: "accounting",
          resourceId: id,
          resourceType: "JournalEntry",
          journalEntryId: id,
          oldValues: { lineId, accountId: line.accountId },
          newValues: { lineId, accountId: destinationAccountId, code: destination.code },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في نقل السطر";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
