import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ chargeId: string }>;
}

async function loadCharge(chargeId: string) {
  return prisma.managerCharge.findUnique({ where: { id: chargeId }, select: { id: true, companyId: true } });
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  amount: z.number().min(0).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { chargeId } = await params;
    const charge = await loadCharge(chargeId);
    if (!charge) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, charge.companyId);
    if (accessError) return accessError;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const d = parsed.data;
    await prisma.managerCharge.update({
      where: { id: chargeId },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.month !== undefined ? { month: d.month } : {}),
        ...(d.year !== undefined ? { year: d.year } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? new Date(d.dueDate) : null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { chargeId } = await params;
    const charge = await loadCharge(chargeId);
    if (!charge) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, charge.companyId);
    if (accessError) return accessError;
    await prisma.managerCharge.delete({ where: { id: chargeId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

const paymentSchema = z.object({
  amount: z.number().positive("المبلغ مطلوب"),
  paidDate: z.string().min(1, "تاريخ السداد مطلوب"),
  notes: z.string().nullable().optional(),
});

// تسجيل تحصيل على المستحق
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { chargeId } = await params;
    const charge = await loadCharge(chargeId);
    if (!charge) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, charge.companyId);
    if (accessError) return accessError;

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const p = parsed.data;
    const payment = await prisma.managerChargePayment.create({
      data: { chargeId, amount: p.amount, paidDate: new Date(p.paidDate), notes: p.notes ?? null, createdById: session.id },
    });
    return NextResponse.json({ success: true, data: { id: payment.id } }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تسجيل التحصيل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
