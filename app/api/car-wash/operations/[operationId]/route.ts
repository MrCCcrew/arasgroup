import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ operationId: string }>;
}

function expenseReference(operationId: string) {
  return `CWOP:${operationId}`;
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
