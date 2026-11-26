import type { Prisma } from "@prisma/client";

export function salaryPaymentItemsWhere(payment: { id: string; batchId: string; employeeId: string }) {
  return {
    batchId: payment.batchId,
    OR: [
      { salaryPaymentId: payment.id },
      { salaryPaymentId: null, employeeId: payment.employeeId },
    ],
  };
}

export async function linkSalaryItemsToPayments(
  tx: Pick<Prisma.TransactionClient, "salaryItem">,
  batchId: string,
  payments: Array<{ id: string; employeeId: string }>,
) {
  for (const payment of payments) {
    await tx.salaryItem.updateMany({
      where: { batchId, employeeId: payment.employeeId, salaryPaymentId: null },
      data: { salaryPaymentId: payment.id },
    });
  }
}
