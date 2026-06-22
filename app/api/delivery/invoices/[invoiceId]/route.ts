import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ invoiceId: string }>;
}

async function loadInvoice(invoiceId: string) {
  return prisma.deliveryInvoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: { id: true, companyId: true },
  });
}

const patchSchema = z.object({
  targetType: z.enum(["DRIVER", "EMPLOYEE"]).optional(),
  driverId: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  invoiceDate: z.string().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { invoiceId } = await params;
    const invoice = await loadInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
    const accessError = assertCompanyAccess(session, invoice.companyId);
    if (accessError) return accessError;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const d = parsed.data;

    // ضمان وجود طرف واضح عند تغيير النوع
    if (d.targetType === "DRIVER" && d.driverId === null) return NextResponse.json({ success: false, error: "اختر السائق" }, { status: 400 });
    if (d.targetType === "EMPLOYEE" && d.employeeId === null) return NextResponse.json({ success: false, error: "اختر الموظف" }, { status: 400 });

    await prisma.deliveryInvoice.update({
      where: { id: invoiceId },
      data: {
        ...(d.targetType !== undefined ? { targetType: d.targetType } : {}),
        ...(d.driverId !== undefined ? { driverId: d.driverId } : {}),
        ...(d.employeeId !== undefined ? { employeeId: d.employeeId } : {}),
        ...(d.invoiceDate !== undefined ? { invoiceDate: new Date(`${d.invoiceDate}T12:00:00.000`) } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.currency !== undefined ? { currency: d.currency } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في التعديل" }, { status: 400 });
  }
}

// حذف ناعم — لا يُحذف نهائيًا.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { invoiceId } = await params;
    const invoice = await loadInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
    const accessError = assertCompanyAccess(session, invoice.companyId);
    if (accessError) return accessError;
    await prisma.deliveryInvoice.update({ where: { id: invoiceId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في الحذف" }, { status: 400 });
  }
}
