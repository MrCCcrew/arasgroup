import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props {
  params: Promise<{ settlementId: string }>;
}

const patchSchema = z.object({
  settlementDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  grossAmount: z.number().positive().optional(),
  commission: z.number().min(0).optional(),
  netAmount: z.number().optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { settlementId } = await params;
    const settlement = await prisma.knetSettlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, settlement.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.knetSettlement.update({ where: { id: settlementId }, data: parsed.data });
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
    const { settlementId } = await params;
    const settlement = await prisma.knetSettlement.findUnique({
      where: { id: settlementId },
      select: { id: true, companyId: true, journalEntryId: true },
    });
    if (!settlement) return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, settlement.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Unlink transactions first then delete
      await tx.knetTransaction.updateMany({
        where: { settlementId },
        data: { settlementId: null },
      });
      await tx.knetSettlement.delete({ where: { id: settlementId } });

      if (settlement.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: settlement.journalEntryId },
          data: { status: "CANCELLED", descriptionAr: "ملغى — تم حذف سجل التسوية المرتبط" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
