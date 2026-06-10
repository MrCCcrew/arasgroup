import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ accountId: string }>;
}

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
  parentId: z.string().nullable().optional(),
  isHeader: z.boolean().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function getAccountForAccess(accountId: string) {
  return prisma.chartOfAccount.findUnique({
    where: { id: accountId },
    select: { id: true, companyId: true },
  });
}

// يعيد حساب المستوى (level) للحساب وكل فروعه بعد تغيير الأب
async function recomputeLevels(tx: Prisma.TransactionClient, accountId: string, level: number) {
  await tx.chartOfAccount.update({ where: { id: accountId }, data: { level } });
  const children = await tx.chartOfAccount.findMany({ where: { parentId: accountId }, select: { id: true } });
  for (const child of children) {
    await recomputeLevels(tx, child.id, level + 1);
  }
}

// يجمع كل معرّفات الفروع (لمنع جعل الأب فرعًا من فروعه = حلقة)
async function collectDescendantIds(accountId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const queue = [accountId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await prisma.chartOfAccount.findMany({ where: { parentId: current }, select: { id: true } });
    for (const child of children) {
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
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

    const current = await prisma.chartOfAccount.findUnique({
      where: { id: accountId },
      select: { level: true, parentId: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, error: "الحساب غير موجود" }, { status: 404 });
    }

    const { parentId, ...rest } = parsed.data;
    const parentChanged = parentId !== undefined && parentId !== current.parentId;

    // تحقق من الأب الجديد: لا يكون نفس الحساب ولا أحد فروعه (منع الحلقات)
    let newLevel = current.level;
    if (parentChanged) {
      if (parentId) {
        if (parentId === accountId) {
          return NextResponse.json({ success: false, error: "لا يمكن جعل الحساب أبًا لنفسه" }, { status: 400 });
        }
        const descendants = await collectDescendantIds(accountId);
        if (descendants.has(parentId)) {
          return NextResponse.json({ success: false, error: "لا يمكن نقل الحساب تحت أحد فروعه" }, { status: 400 });
        }
        const parent = await prisma.chartOfAccount.findFirst({
          where: { id: parentId, companyId: account.companyId },
          select: { level: true },
        });
        if (!parent) {
          return NextResponse.json({ success: false, error: "الحساب الأب غير موجود" }, { status: 400 });
        }
        newLevel = parent.level + 1;
      } else {
        newLevel = 1;
      }
    }

    try {
      const updatedAccount = await prisma.$transaction(async (tx) => {
        const updated = await tx.chartOfAccount.update({
          where: { id: accountId },
          data: { ...rest, ...(parentChanged ? { parentId: parentId ?? null } : {}) },
        });
        if (parentChanged) {
          await recomputeLevels(tx, accountId, newLevel);
        }
        return updated;
      });

      return NextResponse.json({ success: true, data: updatedAccount });
    } catch (txError: unknown) {
      if (typeof txError === "object" && txError && "code" in txError && (txError as { code?: string }).code === "P2002") {
        return NextResponse.json({ success: false, error: "رمز الحساب موجود بالفعل" }, { status: 400 });
      }
      throw txError;
    }
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
