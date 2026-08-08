import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { createCarWashDailyJE, createExpenseJE } from "@/lib/accounting/auto-entries";
import { resolveExpenseAccountCode } from "@/lib/accounting/expense-accounts";

interface Props {
  params: Promise<{ operationId: string }>;
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

const updateOperationSchema = z.object({
  vehicleId: z.string(),
  locationId: z.string(),
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { operationId } = await params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const operation = await prisma.carWashDailyOperation.findFirst({
      where: {
        id: operationId,
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

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.id;
    const { operationId } = await params;

    const body = await request.json();
    const parsed = updateOperationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    const existingOperation = await prisma.carWashDailyOperation.findFirst({
      where: { id: operationId, companyId: data.companyId },
      select: { id: true, journalEntryId: true },
    });

    if (!existingOperation) {
      return NextResponse.json({ success: false, error: "العملية غير موجودة أو غير مصرح بها" }, { status: 404 });
    }

    // Get linked expense records (from general expenses table)
    const linkedExpenses = await prisma.expense.findMany({
      where: {
        reference: `CWOP:${operationId}`,
        companyId: data.companyId,
        isDeleted: false,
      },
      select: { id: true, journalEntryId: true },
    });

    const totalCash = data.revenues.filter((r) => r.type === "CASH").reduce((s, r) => s + r.amount, 0);
    const totalKnet = data.revenues.filter((r) => r.type === "KNET").reduce((s, r) => s + r.amount, 0);
    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
    const netRevenue = totalCash + totalKnet - totalExpenses;

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
          { success: false, error: "مركز تكلفة مركبة الغسيل غير صالح" },
          { status: 400 },
        );
      }
      validatedCostCenterId = costCenter.id;
    }

    const operation = await prisma.$transaction(async (tx) => {
      if (existingOperation.journalEntryId) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: existingOperation.journalEntryId } });
        await tx.journalEntry.deleteMany({ where: { id: existingOperation.journalEntryId } });
      }

      // Delete old expense journal entries and expense records
      for (const expense of linkedExpenses) {
        if (expense.journalEntryId) {
          await tx.journalEntryLine.deleteMany({ where: { journalEntryId: expense.journalEntryId } });
          await tx.journalEntry.deleteMany({ where: { id: expense.journalEntryId } });
        }
        await tx.expense.deleteMany({ where: { id: expense.id } });
      }

      await tx.knetTransaction.deleteMany({ where: { operationId } });
      await tx.carWashRevenue.deleteMany({ where: { operationId } });
      await tx.carWashExpense.deleteMany({ where: { operationId } });

      const op = await tx.carWashDailyOperation.update({
        where: { id: operationId },
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
          throw new Error(`فئة المصروف في السطر رقم ${index + 1} غير صالحة`);
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

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { operationId } = await params;
    const operation = await prisma.carWashDailyOperation.findUnique({
      where: { id: operationId },
      include: {
        expenses: { select: { amount: true, description: true } },
        knetTransactions: { select: { id: true, settlementId: true } },
      },
    });

    if (!operation) {
      return NextResponse.json({ success: false, error: "العملية غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, operation.companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    const settledTransactions = operation.knetTransactions.filter((transaction) => transaction.settlementId);
    if (settledTransactions.length > 0) {
      return NextResponse.json(
        { success: false, error: "لا يمكن حذف العملية بعد تسوية عمليات KNET المرتبطة بها" },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const linkedExpenses = await tx.expense.findMany({
        where: {
          companyId: operation.companyId,
          isDeleted: false,
          OR: [
            { reference: expenseReference(operationId) },
            ...operation.expenses.map((expense) => ({
              carWashVehicleId: operation.vehicleId,
              date: operation.date,
              amount: expense.amount,
              descriptionAr: `مصروف غسيل سيارات - ${expense.description}`,
            })),
          ],
        },
        select: { id: true, journalEntryId: true },
      });

      for (const expense of linkedExpenses) {
        await tx.expense.update({
          where: { id: expense.id },
          data: { isDeleted: true, reference: expenseReference(operationId) },
        });

        if (expense.journalEntryId) {
          await tx.journalEntry.update({
            where: { id: expense.journalEntryId },
            data: {
              status: "CANCELLED",
              descriptionAr: "ملغى - تم حذف عملية الغسيل المرتبطة بهذا المصروف",
            },
          });
        }
      }

      await tx.knetTransaction.deleteMany({
        where: { operationId },
      });

      if (operation.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: operation.journalEntryId },
          data: {
            status: "CANCELLED",
            descriptionAr: "ملغى - تم حذف عملية الغسيل المرتبطة",
          },
        });
      }

      await tx.carWashDailyOperation.delete({
        where: { id: operationId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف العملية";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
