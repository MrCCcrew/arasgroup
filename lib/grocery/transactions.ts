import { prisma } from "@/lib/db";

export type RetailTransaction = {
  id: string; kind: "PURCHASE" | "EXPENSE" | "SALE" | "DEPOSIT" | "STATEMENT"; date: Date; reference: string;
  amount: number | null; paymentMethod: string | null; notes: string | null; fileUrl: string | null; createdById: string; createdAt: Date;
};

export async function getRetailTransactions(companyId: string, createdById?: string): Promise<RetailTransaction[]> {
  const where = createdById ? { companyId, createdById } : { companyId };
  const [purchases, expenses, sales, deposits, statements] = await Promise.all([
    prisma.groceryPurchaseInvoice.findMany({ where, orderBy: { date: "desc" }, take: 200 }),
    prisma.groceryOperatingExpense.findMany({ where, orderBy: { date: "desc" }, take: 200 }),
    prisma.grocerySaleInvoice.findMany({ where, orderBy: { date: "desc" }, take: 200 }),
    prisma.groceryDepositReceipt.findMany({ where, orderBy: { date: "desc" }, take: 200 }),
    prisma.groceryBankStatement.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return [
    ...purchases.map((r) => ({ id: r.id, kind: "PURCHASE" as const, date: r.date, reference: r.invoiceNumber, amount: Number(r.amount), paymentMethod: r.paymentMethod, notes: r.notes, fileUrl: r.fileUrl, createdById: r.createdById, createdAt: r.createdAt })),
    ...expenses.map((r) => ({ id: r.id, kind: "EXPENSE" as const, date: r.date, reference: r.reference, amount: Number(r.amount), paymentMethod: r.paymentMethod, notes: r.notes, fileUrl: r.fileUrl, createdById: r.createdById, createdAt: r.createdAt })),
    ...sales.map((r) => ({ id: r.id, kind: "SALE" as const, date: r.date, reference: r.invoiceNumber, amount: Number(r.amount), paymentMethod: r.paymentMethod, notes: r.notes, fileUrl: r.fileUrl, createdById: r.createdById, createdAt: r.createdAt })),
    ...deposits.map((r) => ({ id: r.id, kind: "DEPOSIT" as const, date: r.date, reference: r.notes || "-", amount: Number(r.amount), paymentMethod: r.paymentMethod, notes: r.notes, fileUrl: r.fileUrl, createdById: r.createdById, createdAt: r.createdAt })),
    ...statements.map((r) => ({ id: r.id, kind: "STATEMENT" as const, date: r.fromDate || r.createdAt, reference: "-", amount: null, paymentMethod: null, notes: null, fileUrl: r.fileUrl, createdById: r.createdById, createdAt: r.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
}
