import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCarWashDailyJE, createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

const revenueSchema = z.object({
  type: z.enum(["CASH", "KNET"]),
  amount: z.number().min(0),
  description: z.string().optional(),
});

const expenseSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.number().min(0),
  description: z.string(),
});

const createOperationSchema = z.object({
  vehicleId: z.string(),
  locationId: z.string(),
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const vehicleId = searchParams.get("vehicleId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const operations = await prisma.carWashDailyOperation.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(vehicleId ? { vehicleId } : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      include: {
        vehicle: { select: { code: true, nameAr: true } },
        location: { select: { nameAr: true } },
        revenues: true,
        expenses: true,
        knetTransactions: { select: { id: true, amount: true, isSettled: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: operations });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب العمليات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.id;

    const body = await request.json();
    const parsed = createOperationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    const totalCash = data.revenues.filter((r) => r.type === "CASH").reduce((s, r) => s + r.amount, 0);
    const totalKnet = data.revenues.filter((r) => r.type === "KNET").reduce((s, r) => s + r.amount, 0);
    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
    const netRevenue = totalCash + totalKnet - totalExpenses;

    // Get car wash vehicle to find cost center
    const cwVehicle = await prisma.carWashVehicle.findUnique({
      where: { id: data.vehicleId },
      select: { costCenterId: true },
    });

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.carWashDailyOperation.create({
        data: {
          vehicleId: data.vehicleId,
          locationId: data.locationId,
          companyId: data.companyId,
          date: data.date,
          totalCash,
          totalKnet,
          totalExpenses,
          netRevenue,
          notes: data.notes,
          revenues: {
            create: data.revenues.map((r) => ({ type: r.type, amount: r.amount, description: r.description })),
          },
          expenses: {
            create: data.expenses.map((e) => ({ categoryId: e.categoryId, amount: e.amount, description: e.description })),
          },
        },
        include: { revenues: true, expenses: true },
      });

      // Create KNET transactions for KNET revenues
      const knetRevenues = data.revenues.filter((r) => r.type === "KNET");
      for (const kr of knetRevenues) {
        await tx.knetTransaction.create({
          data: {
            operationId: op.id,
            amount: kr.amount,
            date: data.date,
            isSettled: false,
          },
        });
      }

      let primaryJournalEntryId: string | undefined;

      // Auto revenue journal entry
      if (totalCash > 0 || totalKnet > 0) {
        const je = await createCarWashDailyJE({
          companyId: data.companyId,
          userId,
          vehicleId: data.vehicleId,
          costCenterId: cwVehicle?.costCenterId ?? "",
          cashAmount: totalCash,
          knetAmount: totalKnet,
          date: data.date,
          refId: op.id,
        });

        primaryJournalEntryId = je.id;
      }

      for (const [index, expense] of data.expenses.entries()) {
        if (expense.amount <= 0) continue;

        if (!expense.categoryId) {
          throw new Error(`فئة المصروف مطلوبة في السطر رقم ${index + 1}`);
        }

        const category = await tx.expenseCategory.findUnique({
          where: { id: expense.categoryId },
          select: { id: true, companyId: true, type: true },
        });
        if (!category || category.companyId !== data.companyId) {
          throw new Error(`فئة المصروف في السطر رقم ${index + 1} غير صالحة لهذه الشركة`);
        }

        const accountingExpense = await tx.expense.create({
          data: {
            companyId: data.companyId,
            categoryId: expense.categoryId,
            date: data.date,
            amount: expense.amount,
            descriptionAr: expense.description,
            paymentMethod: "CASH",
            costCenterId: cwVehicle?.costCenterId ?? undefined,
            carWashVehicleId: data.vehicleId,
            status: "POSTED",
          },
        });

        const expenseJournalEntry = await createExpenseJE({
          companyId: data.companyId,
          userId,
          expenseAccountCode: resolveExpenseAccountCode(category.type),
          amount: expense.amount,
          isCash: true,
          costCenterId: cwVehicle?.costCenterId ?? undefined,
          refId: accountingExpense.id,
          descriptionAr: `مصروف غسيل سيارات - ${expense.description}`,
        });

        await tx.expense.update({
          where: { id: accountingExpense.id },
          data: { journalEntryId: expenseJournalEntry.id },
        });

        primaryJournalEntryId ??= expenseJournalEntry.id;
      }

      if (primaryJournalEntryId) {
        await tx.carWashDailyOperation.update({
          where: { id: op.id },
          data: { journalEntryId: primaryJournalEntryId, status: "CLOSED" },
        });
      }

      return op;
    });

    return NextResponse.json({ success: true, data: operation }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ العملية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
