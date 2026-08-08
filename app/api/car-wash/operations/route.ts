import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCarWashDailyJE, createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

const KUWAIT_OFFSET = "+03:00";

function parseKuwaitCalendarDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${KUWAIT_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function expenseReference(operationId: string) {
  return `CWOP:${operationId}`;
}

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
    const fromDate = searchParams.get("fromDate") ?? searchParams.get("startDate");
    const toDate = searchParams.get("toDate") ?? searchParams.get("endDate");
    const month = Number.parseInt(searchParams.get("month") ?? "", 10);
    const year = Number.parseInt(searchParams.get("year") ?? "", 10);
    const rangeStart = parseKuwaitCalendarDate(fromDate);
    const rangeEnd = parseKuwaitCalendarDate(toDate, true);
    const hasDateRange = Boolean(rangeStart || rangeEnd);
    const validMonth = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year);
    const monthLastDay = validMonth ? new Date(Date.UTC(year, month, 0)).getUTCDate() : undefined;
    const monthStart = validMonth ? parseKuwaitCalendarDate(`${year}-${String(month).padStart(2, "0")}-01`) : undefined;
    const monthEnd = validMonth && monthLastDay ? parseKuwaitCalendarDate(`${year}-${String(month).padStart(2, "0")}-${String(monthLastDay).padStart(2, "0")}`, true) : undefined;
    const date = hasDateRange
      ? { ...(rangeStart ? { gte: rangeStart } : {}), ...(rangeEnd ? { lte: rangeEnd } : {}) }
      : monthStart && monthEnd ? { gte: monthStart, lte: monthEnd } : undefined;

    const operations = await prisma.carWashDailyOperation.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(vehicleId ? { vehicleId } : {}),
        ...(date ? { date } : {}),
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

    // Resolve the vehicle and only pass a valid cost center belonging to the same company.
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
            create: data.revenues.map((r) => ({ type: r.type, amount: r.amount, description: r.description, date: r.date })),
          },
          expenses: {
            create: data.expenses.map((e) => ({ categoryId: e.categoryId, amount: e.amount, description: e.description, date: e.date })),
          },
        },
        include: { revenues: true, expenses: true },
      });

      // Create KNET transactions for KNET revenues (using their actual dates)
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
        const dateKey = rev.date.toISOString().split('T')[0];
        const existing = revenuesByDate.get(dateKey) ?? { cash: 0, knet: 0 };
        if (rev.type === 'CASH') {
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

      // Group expenses by date and category for separate journal entries
      type ExpenseGroupKey = string; // "date|categoryId"
      const expenseGroups = new Map<ExpenseGroupKey, {
        categoryId: string;
        date: Date;
        totalAmount: number;
        descriptions: string[];
        expenseIds: string[];
      }>();

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
            reference: expenseReference(op.id),
            costCenterId: validatedCostCenterId,
            carWashVehicleId: data.vehicleId,
            status: "POSTED",
          },
        });

        // Group by date and category
        const dateKey = expense.date.toISOString().split('T')[0];
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

        const combinedDescription = group.descriptions.length === 1
          ? `مصروف غسيل سيارات - ${group.descriptions[0]}`
          : `مصروف غسيل سيارات - ${group.descriptions.join(' + ')}`;

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

        // Update all expenses in this group with the journal entry ID
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

    return NextResponse.json({ success: true, data: operation }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ العملية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
