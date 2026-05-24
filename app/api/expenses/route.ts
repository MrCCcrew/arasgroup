import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";
import { z } from "zod";

const createExpenseSchema = z.object({
  companyId: z.string(),
  categoryId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً"),
  descriptionAr: z.string().min(3),
  descriptionEn: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK", "CARD", "CHEQUE"]).default("CASH"),
  bankAccountId: z.string().optional(),
  reference: z.string().optional(),
  // Allocation
  branchId: z.string().optional(),
  driverId: z.string().optional(),
  employeeId: z.string().optional(),
  vehicleId: z.string().optional(),
  investorId: z.string().optional(),
  costCenterId: z.string().optional(),
  carWashVehicleId: z.string().optional(),
  // Accounting
  expenseAccountCode: z.string().optional(), // Override auto-detection
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const where = {
      companyId,
      isDeleted: false,
      ...(categoryId ? { categoryId } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { nameAr: true, type: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب المصروفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    // Get category to determine accounting code
    const category = await prisma.expenseCategory.findUnique({ where: { id: data.categoryId } });
    const accountCode = resolveExpenseAccountCode(category?.type, data.expenseAccountCode);

    const expense = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          companyId: data.companyId,
          categoryId: data.categoryId,
          date: data.date,
          amount: data.amount,
          descriptionAr: data.descriptionAr,
          descriptionEn: data.descriptionEn,
          paymentMethod: data.paymentMethod,
          bankAccountId: data.bankAccountId,
          reference: data.reference,
          branchId: data.branchId,
          driverId: data.driverId,
          employeeId: data.employeeId,
          vehicleId: data.vehicleId,
          investorId: data.investorId,
          costCenterId: data.costCenterId,
          carWashVehicleId: data.carWashVehicleId,
          status: "POSTED",
        },
      });

      const je = await createExpenseJE({
        companyId: data.companyId,
        userId,
        expenseAccountCode: accountCode,
        amount: data.amount,
        isCash: data.paymentMethod === "CASH",
        costCenterId: data.costCenterId,
        refId: expense.id,
        descriptionAr: data.descriptionAr,
      });

      await tx.expense.update({
        where: { id: expense.id },
        data: { journalEntryId: je.id },
      });

      return expense;
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ المصروف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
