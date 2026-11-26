import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { contractFields, contractInputError } from "@/lib/delivery/contract-input";

interface Props {
  params: Promise<{ contractId: string }>;
}

const updateSchema = contractFields.partial();

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;
    const existing = await prisma.deliveryContract.findUnique({ where: { id: contractId } });
    if (!existing) return NextResponse.json({ success: false, error: "العقد غير موجود" }, { status: 404 });
    const denied = assertCompanyAccess(session, existing.companyId) || assertPermission(session, "DELIVERY_OPERATIONS", "UPDATE", { companyId: existing.companyId });
    if (denied) return denied;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const error = contractInputError({ ...existing, ...parsed.data });
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });
    const contract = await prisma.deliveryContract.update({
      where: { id: contractId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;
    const existing = await prisma.deliveryContract.findUnique({ where: { id: contractId } });
    if (!existing) return NextResponse.json({ success: false, error: "العقد غير موجود" }, { status: 404 });
    const denied = assertCompanyAccess(session, existing.companyId) || assertPermission(session, "DELIVERY_OPERATIONS", "DELETE", { companyId: existing.companyId });
    if (denied) return denied;

    const reportCount = await prisma.deliveryMonthlyReport.count({ where: { contractId } });
    if (reportCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف العقد — مرتبط بـ ${reportCount} تقرير شهري` },
        { status: 400 }
      );
    }

    await prisma.deliveryContract.update({
      where: { id: contractId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
