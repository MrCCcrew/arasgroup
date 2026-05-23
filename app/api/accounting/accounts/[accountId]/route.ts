import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

interface Ctx { params: Promise<{ accountId: string }> }

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { accountId } = await params;
  const account = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
  return NextResponse.json({ success: true, data: account });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { accountId } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const account = await prisma.chartOfAccount.update({ where: { id: accountId }, data: parsed.data });
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { accountId } = await params;

    // Check child accounts
    const childCount = await prisma.chartOfAccount.count({ where: { parentId: accountId, isActive: true } });
    if (childCount > 0) {
      return NextResponse.json({ success: false, error: `لا يمكن الحذف — يوجد ${childCount} حساب فرعي مرتبط`, type: "HAS_CHILDREN" }, { status: 409 });
    }

    // Check journal entry lines
    const lineCount = await prisma.journalEntryLine.count({ where: { accountId } });
    if (lineCount > 0) {
      // Return sample journal entries for navigation
      const entries = await prisma.journalEntryLine.findMany({
        where: { accountId },
        include: {
          journalEntry: { select: { id: true, number: true, date: true, descriptionAr: true, type: true } },
        },
        orderBy: { journalEntry: { date: "desc" } },
        take: 10,
      });
      type EntryRef = typeof entries[number]["journalEntry"];
      const uniqueEntries = Array.from(
        new Map(entries.map((l) => [l.journalEntryId, l.journalEntry] as [string, EntryRef])).values()
      );
      return NextResponse.json({
        success: false,
        error: `لا يمكن الحذف — يوجد ${lineCount} قيد مرتبط بهذا الحساب`,
        type: "HAS_TRANSACTIONS",
        count: lineCount,
        entries: uniqueEntries,
      }, { status: 409 });
    }

    // Safe to delete (soft delete)
    await prisma.chartOfAccount.update({ where: { id: accountId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
