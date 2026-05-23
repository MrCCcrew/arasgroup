import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

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

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { fiscalYearId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const d = parsed.data;

    if (d.isCurrent) {
      const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId }, select: { companyId: true } });
      if (fy) {
        await prisma.fiscalYear.updateMany({ where: { companyId: fy.companyId }, data: { isCurrent: false } });
      }
    }

    const updated = await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        ...d,
        startDate: d.startDate ? new Date(d.startDate) : undefined,
        endDate: d.endDate ? new Date(d.endDate) : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث السنة المالية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { fiscalYearId } = await params;

    const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
    if (!fy) return NextResponse.json({ success: false, error: "السنة المالية غير موجودة" }, { status: 404 });
    if (fy.isLocked) return NextResponse.json({ success: false, error: "السنة المالية مقفلة — لا يمكن الحذف" }, { status: 400 });

    const jeCount = await prisma.journalEntry.count({ where: { fiscalYearId, isDeleted: false } });
    if (jeCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف السنة المالية — تحتوي على ${jeCount} قيد محاسبي` },
        { status: 400 }
      );
    }

    await prisma.fiscalYear.delete({ where: { id: fiscalYearId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف السنة المالية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
