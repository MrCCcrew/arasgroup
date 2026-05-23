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
    const driverId = searchParams.get("driverId");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const violations = await prisma.driverViolation.findMany({
      where: {
        companyId,
        ...(driverId ? { driverId } : {}),
      },
      include: {
        driver: {
          include: { employee: { select: { nameAr: true, nameEn: true } } },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: violations });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب المخالفات" }, { status: 500 });
  }
}

const createSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().optional(),
  driverId: z.string().min(1),
  date: z.string().transform((s) => new Date(s)),
  type: z.string().min(1),
  amount: z.number().min(0),
  driverPays: z.boolean().default(true),
  paymentMode: z.enum(["FULL", "INSTALLMENT"]).default("FULL"),
  installmentMonths: z.number().int().min(1).optional(),
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

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;

    const violation = await prisma.driverViolation.create({ data });

    return NextResponse.json({ success: true, data: violation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تسجيل المخالفة" }, { status: 500 });
  }
}
