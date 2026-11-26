import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { createViolationInstallments } from "@/lib/hr/driver-violation-installments";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const driverId = searchParams.get("driverId");
    const status = searchParams.get("status");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId ظ…ط·ظ„ظˆط¨" }, { status: 400 });

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
        employee: { select: { nameAr: true, nameEn: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: violations });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ط®ط§ظ„ظپط§طھ" }, { status: 500 });
  }
}

const createSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().optional(),
  driverId: z.string().optional(),
  employeeId: z.string().optional(),
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
  installmentStartYear: z.number().int().min(2020).max(2200).optional(),
  installmentStartMonth: z.number().int().min(1).max(12).optional(),
  notes: z.string().optional(),
  expenseCategoryId: z.string().optional(),
}).refine((data) => data.driverId || data.employeeId, {
  message: "ظٹط¬ط¨ طھط­ط¯ظٹط¯ ط³ط§ط¦ظ‚ ط£ظˆ ظ…ظˆط¸ظپ",
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
      if ((data.responsibility === "COMPANY" || data.responsibility === "SPLIT") && data.expenseCategoryId) {
        const category = await tx.expenseCategory.findFirst({ where: { id: data.expenseCategoryId, companyId: data.companyId } });
        if (!category) throw new Error("فئة مصروف الشركة غير صالحة");
      }

      const created = await tx.driverViolation.create({
        data: {
          companyId: data.companyId, branchId: data.branchId, driverId: data.driverId, employeeId: data.employeeId,
          vehicleId: data.vehicleId, date: data.date, locationAr: data.locationAr, locationEn: data.locationEn,
          type: data.type, descriptionAr: data.descriptionAr, descriptionEn: data.descriptionEn, amount: data.amount,
          responsibility: data.responsibility, driverSharePct: data.driverSharePct, paymentMode: data.paymentMode,
          installmentMonths: data.paymentMode === "INSTALLMENT" ? data.installmentMonths : null,
          installmentStartYear: data.installmentStartYear ?? data.date.getUTCFullYear(),
          installmentStartMonth: data.installmentStartMonth ?? data.date.getUTCMonth() + 1,
          driverPays: data.responsibility !== "COMPANY", status: "PENDING",
          companyExpenseCategoryId: data.responsibility === "COMPANY" || data.responsibility === "SPLIT" ? data.expenseCategoryId ?? null : null,
          notes: data.notes,
        },
      });
      await createViolationInstallments(tx, created);
      return created;
    });

    return NextResponse.json({ success: true, data: violation }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "ظپط´ظ„ ظپظٹ طھط³ط¬ظٹظ„ ط§ظ„ظ…ط®ط§ظ„ظپط©" }, { status: 500 });
  }
}

