import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props {
  params: Promise<{ paymentId: string }>;
}

const patchSchema = z.object({
  platform: z.string().optional().nullable(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).optional(),
  grossAmount: z.number().min(0).optional(),
  walletDeductions: z.number().min(0).optional(),
  netReceived: z.number().optional(),
  receivedDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  bankAccountId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { paymentId } = await params;

    const payment = await prisma.companyPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, payment.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.companyPayment.update({
      where: { id: paymentId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { paymentId } = await params;

    const payment = await prisma.companyPayment.findUnique({
      where: { id: paymentId },
      select: { id: true, companyId: true, journalEntryId: true },
    });
    if (!payment) {
      return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, payment.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.companyPayment.delete({ where: { id: paymentId } });

      if (payment.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: payment.journalEntryId },
          data: { status: "CANCELLED", descriptionAr: "ملغى — تم حذف سجل الدفعة المرتبط" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
