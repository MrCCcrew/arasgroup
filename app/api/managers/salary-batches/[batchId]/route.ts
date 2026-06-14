import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ batchId: string }>;
}

async function loadBatch(batchId: string) {
  return prisma.managerSalaryBatch.findUnique({ where: { id: batchId }, select: { id: true, companyId: true } });
}

const patchSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  bankCommission: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({ employeeId: z.string().min(1), amount: z.number().min(0) })).optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { batchId } = await params;
    const batch = await loadBatch(batchId);
    if (!batch) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, batch.companyId);
    if (accessError) return accessError;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.managerSalaryBatch.update({
        where: { id: batchId },
        data: {
          ...(d.month !== undefined ? { month: d.month } : {}),
          ...(d.year !== undefined ? { year: d.year } : {}),
          ...(d.bankCommission !== undefined ? { bankCommission: d.bankCommission } : {}),
          ...(d.notes !== undefined ? { notes: d.notes } : {}),
        },
      });
      if (d.lines) {
        await tx.managerSalaryLine.deleteMany({ where: { batchId } });
        if (d.lines.length > 0) {
          await tx.managerSalaryLine.createMany({ data: d.lines.map((l) => ({ batchId, employeeId: l.employeeId, amount: l.amount })) });
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في التعديل" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { batchId } = await params;
    const batch = await loadBatch(batchId);
    if (!batch) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, batch.companyId);
    if (accessError) return accessError;
    await prisma.managerSalaryBatch.delete({ where: { id: batchId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في الحذف" }, { status: 400 });
  }
}

const paymentSchema = z.object({
  amount: z.number().positive("المبلغ مطلوب"),
  paidDate: z.string().min(1, "تاريخ السداد مطلوب"),
  notes: z.string().nullable().optional(),
});

// تسجيل تحصيل على دفعة الرواتب
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { batchId } = await params;
    const batch = await loadBatch(batchId);
    if (!batch) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, batch.companyId);
    if (accessError) return accessError;

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const p = parsed.data;
    const payment = await prisma.managerSalaryPayment.create({
      data: { batchId, amount: p.amount, paidDate: new Date(p.paidDate), notes: p.notes ?? null, createdById: session.id },
    });
    return NextResponse.json({ success: true, data: { id: payment.id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في تسجيل التحصيل" }, { status: 400 });
  }
}
