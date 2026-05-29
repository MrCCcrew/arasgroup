import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Ctx { params: Promise<{ violationId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(_req);
  if (session instanceof NextResponse) return session;

  try {
    const { violationId } = await params;
    const violation = await prisma.driverViolation.findUnique({
      where: { id: violationId },
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        expense: { select: { id: true, amount: true, descriptionAr: true } },
      },
    });
    if (!violation) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });
    return NextResponse.json({ success: true, data: violation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب المخالفة" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(["PENDING", "SETTLED", "CANCELLED"]).optional(),
  installmentsPaid: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  locationAr: z.string().optional().nullable(),
  locationEn: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { violationId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const existing = await prisma.driverViolation.findUnique({
      where: { id: violationId },
      select: { companyId: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, existing.companyId);
    if (companyAccessError) return companyAccessError;

    const updated = await prisma.driverViolation.update({
      where: { id: violationId },
      data: parsed.data,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { violationId } = await params;
    const existing = await prisma.driverViolation.findUnique({
      where: { id: violationId },
      select: { companyId: true, expenseId: true, status: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, existing.companyId);
    if (companyAccessError) return companyAccessError;

    if (existing.status === "SETTLED") {
      return NextResponse.json({ success: false, error: "لا يمكن حذف مخالفة تم تسويتها" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverViolation.delete({ where: { id: violationId } });
      if (existing.expenseId) {
        await tx.expense.update({ where: { id: existing.expenseId }, data: { isDeleted: true } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
