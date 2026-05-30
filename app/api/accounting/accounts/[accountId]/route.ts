import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ accountId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function getAccountForAccess(accountId: string) {
  return prisma.chartOfAccount.findUnique({
    where: { id: accountId },
    select: { id: true, companyId: true },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { accountId } = await params;
  const account = await getAccountForAccess(accountId);
  if (!account) {
    return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
  }

  const companyAccessError = assertCompanyAccess(session, account.companyId);
  if (companyAccessError) return companyAccessError;

  const permissionError = assertPermission(session, "ACCOUNTING", "VIEW", { companyId: account.companyId });
  if (permissionError) return permissionError;

  const fullAccount = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
  return NextResponse.json({ success: true, data: fullAccount });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { accountId } = await params;
    const account = await getAccountForAccess(accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, account.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", { companyId: account.companyId });
    if (permissionError) return permissionError;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updatedAccount = await prisma.chartOfAccount.update({
      where: { id: accountId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: updatedAccount });
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
    const account = await getAccountForAccess(accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, account.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "DELETE", { companyId: account.companyId });
    if (permissionError) return permissionError;

    const childCount = await prisma.chartOfAccount.count({ where: { parentId: accountId, isActive: true } });
    if (childCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن الحذف - يوجد ${childCount} حساب فرعي مرتبط`,
          type: "HAS_CHILDREN",
        },
        { status: 409 },
      );
    }

    const lineCount = await prisma.journalEntryLine.count({ where: { accountId } });
    if (lineCount > 0) {
      const entries = await prisma.journalEntryLine.findMany({
        where: { accountId },
        include: {
          journalEntry: { select: { id: true, number: true, date: true, descriptionAr: true, type: true } },
        },
        orderBy: { journalEntry: { date: "desc" } },
        take: 10,
      });

      type EntryRef = (typeof entries)[number]["journalEntry"];
      const uniqueEntries = Array.from(
        new Map(entries.map((line) => [line.journalEntryId, line.journalEntry] as [string, EntryRef])).values(),
      );

      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن الحذف - يوجد ${lineCount} قيد مرتبط بهذا الحساب`,
          type: "HAS_TRANSACTIONS",
          count: lineCount,
          entries: uniqueEntries,
        },
        { status: 409 },
      );
    }

    await prisma.chartOfAccount.update({ where: { id: accountId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
