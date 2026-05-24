import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props {
  params: Promise<{ ticketId: string }>;
}

const patchSchema = z.object({
  type: z.enum(["ANNUAL_LEAVE", "EMERGENCY", "RESIGNATION", "END_OF_SERVICE", "OTHER"]).optional(),
  destination: z.string().optional().nullable(),
  travelDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  returnDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  cost: z.number().min(0).optional().nullable(),
  paidBy: z.enum(["COMPANY", "INVESTOR"]).optional().nullable(),
  investorId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { ticketId } = await params;

    const ticket = await prisma.employeeTicket.findUnique({
      where: { id: ticketId },
      include: { employee: { select: { companyId: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "التذكرة غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, ticket.employee.companyId);
    if (companyAccessError) return companyAccessError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.employeeTicket.update({
      where: { id: ticketId },
      data: parsed.data,
      include: { employee: { select: { nameAr: true, nameEn: true } } },
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
    const { ticketId } = await params;

    const ticket = await prisma.employeeTicket.findUnique({
      where: { id: ticketId },
      include: { employee: { select: { companyId: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "التذكرة غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, ticket.employee.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    await prisma.employeeTicket.delete({ where: { id: ticketId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
