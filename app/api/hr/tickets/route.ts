import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const employeeId = searchParams.get("employeeId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const tickets = await prisma.employeeTicket.findMany({
      where: {
        employee: { companyId },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { nameAr: true, nameEn: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب التذاكر" }, { status: 500 });
  }
}

const createSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["ANNUAL_LEAVE", "EMERGENCY", "RESIGNATION", "END_OF_SERVICE", "OTHER"]),
  destination: z.string().optional(),
  travelDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  returnDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  cost: z.number().min(0).optional(),
  paidBy: z.enum(["COMPANY", "INVESTOR"]).optional(),
  investorId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { employeeId, ...rest } = parsed.data;

    // Verify employee belongs to an accessible company
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (!employee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, employee.companyId);
    if (companyAccessError) return companyAccessError;

    const ticket = await prisma.employeeTicket.create({
      data: { employeeId, ...rest },
      include: {
        employee: { select: { nameAr: true, nameEn: true } },
      },
    });

    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في إنشاء التذكرة" }, { status: 500 });
  }
}
