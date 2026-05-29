import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ importId: string }> }

const allocationSchema = z.object({
  importRiderId: z.string().min(1),
  allocations: z.array(z.object({
    driverId: z.string().min(1),
    allocationType: z.enum(["MANUAL_FIXED", "MANUAL_PERCENTAGE", "MANUAL_REMAINING"]),
    allocatedOrders: z.number().min(0),
    percentage: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  })).min(1),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId }, select: { companyId: true, status: true },
  });
  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  if (imp.status === "POSTED" || imp.status === "CANCELLED") {
    return NextResponse.json({ success: false, error: "لا يمكن تعديل التوزيع بعد الترحيل أو الإلغاء" }, { status: 400 });
  }

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  const body = await request.json();
  const parsed = allocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const rider = await prisma.talabatReportImportRider.findFirst({
    where: { id: parsed.data.importRiderId, importId },
    select: { id: true, calculatedOrdersRounded: true },
  });
  if (!rider) return NextResponse.json({ success: false, error: "السائق غير موجود في التقرير" }, { status: 404 });

  // Validate total allocated = calculatedOrdersRounded
  const totalAllocated = parsed.data.allocations.reduce((s, a) => s + a.allocatedOrders, 0);
  const expected = Number(rider.calculatedOrdersRounded);
  if (Math.abs(totalAllocated - expected) > 0.001) {
    return NextResponse.json({
      success: false,
      error: `إجمالي الطلبات الموزعة (${totalAllocated.toFixed(3)}) يجب أن يساوي إجمالي الطلبات المحسوب (${expected.toFixed(3)}) / Total allocated orders must equal calculated orders.`,
    }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing allocations for this rider
    await tx.talabatReportAllocation.deleteMany({ where: { importRiderId: rider.id } });

    // Create new allocations
    await tx.talabatReportAllocation.createMany({
      data: parsed.data.allocations.map((a) => ({
        importRiderId: rider.id,
        driverId: a.driverId,
        allocationType: a.allocationType,
        allocatedOrders: a.allocatedOrders,
        percentage: a.percentage ?? null,
        notes: a.notes ?? null,
        createdById: session.id,
      })),
    });

    // Update rider matching status
    await tx.talabatReportImportRider.update({
      where: { id: rider.id },
      data: { matchingStatus: "MANUALLY_ALLOCATED" },
    });
  });

  return NextResponse.json({ success: true });
}
