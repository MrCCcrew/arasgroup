import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createCarWashDailyJE, createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";

const revenueSchema = z.object({
  type: z.enum(["CASH", "KNET"]),
  amount: z.number().min(0),
  description: z.string().optional(),
  date: z.string().transform((s) => new Date(s)),
});

const expenseSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.number().min(0),
  description: z.string(),
  date: z.string().transform((s) => new Date(s)),
});

const updateOperationSchema = z.object({
  vehicleId: z.string(),
  locationId: z.string(),
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const operation = await prisma.carWashDailyOperation.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        vehicle: { select: { code: true, nameAr: true, nameEn: true } },
        location: { select: { nameAr: true, nameEn: true } },
        revenues: { orderBy: { date: "asc" } },
        expenses: { orderBy: { date: "asc" } },
        knetTransactions: { select: { id: true, amount: true, isSettled: true } },
      },
    });

    if (!operation) {
      return NextResponse.json({ success: false, error: "العملية غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: operation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب العملية" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.id;
    const { id } = await params;

    const body = await request.json();
    const parsed = updateOperationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    // Check operation exists and belongs to the company
    const existingOperation = await prisma.carWashDailyOperation.findFirst({
      where: { id, companyId: data.companyId },
      include: { revenues: true, expenses: { include: { Expense: true } }, journalEntry: true },
    });

    if (!existingOperation) {
      return NextResponse.json({ success: false, error: "العملية غير موجودة أو غير مصرح بها" }, { status: 404 });
    }

    const totalCash = data.revenues.filter((r) => r.type === "CASH").reduce((s, r) => s + r.amount, 0);
    const totalKnet = data.revenues.filter((r) => r.type === "KNET").reduce((s, r) => s + r.amount, 0);
    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
    const netRevenue = totalCash + totalKnet - totalExpenses;

    // Resolve vehicle and cost center
    const cwVehicle = await prisma.carWashVehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, companyId: true, costCenterId: true },
    });
    if (!cwVehicle || cwVehicle.companyId !== data.companyId) {
      return NextResponse.json({ success: false, error: "المركبة المختارة غير صالحة لهذه الشركة" }, { status: 400 });
    }

    let validatedCostCenterId: string | undefined;
    if (cwVehicle.costCenterId) {
      const costCenter = await prisma.costCenter.findFirst({
        where: { id: cwVehicle.costCenterId, companyId: data.companyId },
        select: { id: true },
      });
      if (!costCenter) {
        return NextResponse.json(
          { success: false, error: "مركز تكلفة مركبة الغسيل غير صالح. يرجى مراجعة بيانات المركبة أولاً" },
          { status: 400 },
        );
      }
      validatedCostCenterId = costCenter.id;
    }

    const operation = await prisma.$transaction(async (tx) => {
      // Delete old journal entries
      if (existingOperation.journalEntry) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: existingOperation.journalEntry.id } });
        await tx.journalEntry.delete({ where: { id: existingOperation.journalEntry.id } });
      }

      // Delete old expense journal entries
      for (const expense of existingOperation.expenses) {
        if (expense.Expense && expense.Expense.journalEntryId) {
          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: expense.Expense.journalEntryId } });
          await tx.journalEntry.delete({ where: { id: expense.Expense.journalEntryId } });
        }
        if (expense.Expense) {
          await tx.expense.delete({ where: { id: expense.Expense.id } });
        }
      }

      // Delete old KNET transactions
      await tx.knetTransaction.deleteMany({ where: { operationId: id } });

      // Delete old revenues and expenses
      await tx.carWashRevenue.deleteMany({ where: { operationId: id } });
      await tx.carWashExpense.deleteMany({ where: { operationId: id } });

      // Update operation with new data
      const op = await tx.carWashDailyOperation.update({
        where: { id },
        data: {
          vehicleId: data.vehicleId,
          locationId: data.locationId,
          date: data.date,
          totalCash,
          totalKnet,
          totalExpenses,
          netRevenue,
          notes: data.notes,
          revenues: {
            create: data.revenues.map((r) => ({ type: r.type, amount: r.amount, description: r.description, date: r.date })),
          },
          expenses: {
            create: data.expenses.map((e) => ({ categoryId: e.categoryId, amount: e.amount, description: e.description, date: e.date })),
          },
        },
        include: { revenues: true, expenses: true },
      });

      // Create new KNET transactions
      const knetRevenues = data.revenues.filter((r) => r.type === "KNET");
      for (const kr of knetRevenues) {
        await tx.knetTransaction.create({
          data: {
            operationId: op.id,
            amount: kr.amount,
            date: kr.date,
            isSettled: false,
          },
        });
      }

      let primaryJournalEntryId: string | undefined;

      // Group revenues by date and create separate journal entries
      const revenuesByDate = new Map<string, { cash: number; knet: number }>();
      for (const rev of data.revenues) {
        const dateKey = rev.date.toISOString().split("T")[0];
        const existing = revenuesByDate.get(dateKey) ?? { cash: 0, knet: 0 };
        if (rev.type === "CASH") {
          existing.cash += rev.amount;
        } else {
          existing.knet += rev.amount;
        }
        revenuesByDate.set(dateKey, existing);
      }

      for (const [dateStr, amounts] of revenuesByDate.entries()) {
        if (amounts.cash > 0 || amounts.knet > 0) {
          const je = await createCarWashDailyJE({
            companyId: data.companyId,
            userId,
            vehicleId: data.vehicleId,
            costCenterId: validatedCostCenterId,
            cashAmount: amounts.cash,
            knetAmount: amounts.knet,
            date: new Date(dateStr),
            refId: op.id,
          });

          primaryJournalEntryId ??= je.id;
        }
      }

      // Group expenses by date and category
      type ExpenseGroupKey = string;
      const expenseGroups = new Map<
        ExpenseGroupKey,
        {
          categoryId: string;
          date: Date;
          totalAmount: number;
          descriptions: string[];
          expenseIds: string[];
        }
      >();

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
            date: expense.date,
            amount: expense.amount,
            descriptionAr: expense.description,
            paymentMethod: "CASH",
            reference: `CWOP:${op.id}`,
            costCenterId: validatedCostCenterId,
            carWashVehicleId: data.vehicleId,
            status: "POSTED",
          },
        });

        const dateKey = expense.date.toISOString().split("T")[0];
        const groupKey = `${dateKey}|${expense.categoryId}`;
        const existing = expenseGroups.get(groupKey);
        if (existing) {
          existing.totalAmount += expense.amount;
          existing.descriptions.push(expense.description);
          existing.expenseIds.push(accountingExpense.id);
        } else {
          expenseGroups.set(groupKey, {
            categoryId: expense.categoryId,
            date: expense.date,
            totalAmount: expense.amount,
            descriptions: [expense.description],
            expenseIds: [accountingExpense.id],
          });
        }
      }

      // Create journal entries for grouped expenses
      for (const group of expenseGroups.values()) {
        const category = await tx.expenseCategory.findUnique({
          where: { id: group.categoryId },
          select: { type: true },
        });
        if (!category) continue;

        const combinedDescription =
          group.descriptions.length === 1
            ? `مصروف غسيل سيارات - ${group.descriptions[0]}`
            : `مصروف غسيل سيارات - ${group.descriptions.join(" + ")}`;

        const expenseJournalEntry = await createExpenseJE({
          companyId: data.companyId,
          userId,
          expenseAccountCode: resolveExpenseAccountCode(category.type),
          amount: group.totalAmount,
          isCash: true,
          costCenterId: validatedCostCenterId,
          refId: group.expenseIds[0],
          descriptionAr: combinedDescription,
          date: group.date,
        });

        for (const expenseId of group.expenseIds) {
          await tx.expense.update({
            where: { id: expenseId },
            data: { journalEntryId: expenseJournalEntry.id },
          });
        }

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

    return NextResponse.json({ success: true, data: operation });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث العملية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
