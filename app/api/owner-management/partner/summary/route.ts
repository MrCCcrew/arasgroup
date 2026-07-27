import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { getPartnerFromSession, forbidden } from "@/lib/owner-management/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const partner = await getPartnerFromSession(session); if (!partner) return forbidden();
  const [revenues, expenses, latestRevenues, latestExpenses] = await Promise.all([
    prisma.ownerManagedRevenue.aggregate({ where: { partnerId: partner.id, status: "MATCHED" }, _sum: { amount: true } }),
    prisma.ownerManagedExpense.aggregate({ where: { partnerId: partner.id, deletedAt: null }, _sum: { amount: true } }),
    prisma.ownerManagedRevenue.findMany({ where: { partnerId: partner.id, status: "MATCHED" }, take: 20, orderBy: { transactionDate: "desc" } }),
    prisma.ownerManagedExpense.findMany({ where: { partnerId: partner.id, deletedAt: null }, take: 20, orderBy: { invoiceDate: "desc" } }),
  ]);
  const revenue = Number(revenues._sum.amount ?? 0), expense = Number(expenses._sum.amount ?? 0);
  return NextResponse.json({ success: true, data: { partner: { name: partner.name, mid: partner.mid }, revenue, expense, net: revenue - expense, latestRevenues, latestExpenses } });
}
