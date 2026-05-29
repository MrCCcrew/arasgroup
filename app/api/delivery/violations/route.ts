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
    const status = searchParams.get("status");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const violations = await prisma.driverViolation.findMany({
      where: {
        companyId,
        ...(driverId ? { driverId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
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
  vehicleId: z.string().optional(),
  date: z.string().transform((s) => new Date(s)),
  locationAr: z.string().optional(),
  locationEn: z.string().optional(),
  type: z.string().min(1),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  amount: z.number().min(0),
  responsibility: z.enum(["DRIVER", "COMPANY", "SPLIT"]).default("DRIVER"),
  driverSharePct: z.number().int().min(1).max(99).optional(),
  paymentMode: z.enum(["FULL", "INSTALLMENT"]).default("FULL"),
  installmentMonths: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  expenseCategoryId: z.string().optional(),
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

    const violation = await prisma.$transaction(async (tx) => {
      let expenseId: string | undefined;

      // Auto-create expense for company portion
      const companyPays = data.responsibility === "COMPANY" || data.responsibility === "SPLIT";
      if (companyPays && data.expenseCategoryId) {
        const companySharePct = data.responsibility === "COMPANY" ? 100 : (100 - (data.driverSharePct ?? 50));
        const companyAmount = Number(data.amount) * companySharePct / 100;

        const driver = await tx.driver.findUnique({
          where: { id: data.driverId },
          select: { employee: { select: { nameAr: true } } },
        });

        const expense = await tx.expense.create({
          data: {
            companyId: data.companyId,
            branchId: data.branchId,
            categoryId: data.expenseCategoryId,
            date: data.date,
            amount: companyAmount,
            descriptionAr: `مخالفة مرور — ${driver?.employee.nameAr ?? ""} — ${data.type}`,
            descriptionEn: data.descriptionEn ? `Traffic violation — ${data.type}` : undefined,
            driverId: data.driverId,
            vehicleId: data.vehicleId,
            paymentMethod: "CASH",
          },
        });
        expenseId = expense.id;
      }

      return tx.driverViolation.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          driverId: data.driverId,
          vehicleId: data.vehicleId,
          date: data.date,
          locationAr: data.locationAr,
          locationEn: data.locationEn,
          type: data.type,
          descriptionAr: data.descriptionAr,
          descriptionEn: data.descriptionEn,
          amount: data.amount,
          responsibility: data.responsibility,
          driverSharePct: data.driverSharePct,
          paymentMode: data.paymentMode,
          installmentMonths: data.paymentMode === "INSTALLMENT" ? data.installmentMonths : null,
          driverPays: data.responsibility !== "COMPANY",
          status: "PENDING",
          expenseId,
          notes: data.notes,
        },
      });
    });

    return NextResponse.json({ success: true, data: violation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تسجيل المخالفة" }, { status: 500 });
  }
}
