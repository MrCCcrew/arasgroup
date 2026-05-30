import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ fiscalYearId: string }>;
}

const updateSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

async function getFiscalYearForAccess(fiscalYearId: string) {
  return prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { id: true, companyId: true, isLocked: true },
  });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { fiscalYearId } = await params;
    const fiscalYear = await getFiscalYearForAccess(fiscalYearId);
    if (!fiscalYear) {
      return NextResponse.json({ success: false, error: "السنة المالية غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, fiscalYear.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", {
      companyId: fiscalYear.companyId,
    });
    if (permissionError) return permissionError;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.isCurrent) {
      await prisma.fiscalYear.updateMany({
        where: { companyId: fiscalYear.companyId },
        data: { isCurrent: false },
      });
    }

    const updated = await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تحديث السنة المالية";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { fiscalYearId } = await params;
    const fiscalYear = await getFiscalYearForAccess(fiscalYearId);
    if (!fiscalYear) {
      return NextResponse.json({ success: false, error: "السنة المالية غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, fiscalYear.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "DELETE", {
      companyId: fiscalYear.companyId,
    });
    if (permissionError) return permissionError;

    if (fiscalYear.isLocked) {
      return NextResponse.json({ success: false, error: "السنة المالية مقفلة - لا يمكن الحذف" }, { status: 400 });
    }

    const journalEntryCount = await prisma.journalEntry.count({
      where: { fiscalYearId, isDeleted: false },
    });
    if (journalEntryCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن حذف السنة المالية - تحتوي على ${journalEntryCount} قيد محاسبي`,
        },
        { status: 400 },
      );
    }

    await prisma.fiscalYear.delete({ where: { id: fiscalYearId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف السنة المالية";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
