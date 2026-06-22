import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

// تقرير الفواتير: مجمّع (لكل شخص) + تفصيلي. أرشيفي فقط.
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const targetType = searchParams.get("targetType");
  const driverId = searchParams.get("driverId");
  const employeeId = searchParams.get("employeeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const invoices = await prisma.deliveryInvoice.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(targetType === "DRIVER" || targetType === "EMPLOYEE" ? { targetType } : {}),
      ...(driverId ? { driverId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(from || to
        ? { invoiceDate: { ...(from ? { gte: new Date(`${from}T00:00:00.000`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
        : {}),
    },
    include: {
      driver: { include: { employee: { select: { nameAr: true } } } },
      employee: { select: { nameAr: true } },
    },
    orderBy: [{ invoiceDate: "asc" }],
  });

  const details = invoices.map((inv) => {
    const name = inv.targetType === "DRIVER" ? inv.driver?.employee.nameAr ?? "-" : inv.employee?.nameAr ?? "-";
    return {
      id: inv.id,
      key: inv.driverId ?? inv.employeeId ?? inv.id,
      targetType: inv.targetType,
      name,
      invoiceDate: inv.invoiceDate,
      amount: Number(inv.amount),
      currency: inv.currency,
      imagePath: inv.imagePath,
      notes: inv.notes,
    };
  });

  // مجمّع لكل شخص
  const map = new Map<string, { name: string; targetType: string; count: number; total: number; lastDate: Date }>();
  for (const d of details) {
    const r = map.get(d.key) ?? { name: d.name, targetType: d.targetType, count: 0, total: 0, lastDate: d.invoiceDate };
    r.count += 1;
    r.total += d.amount;
    if (d.invoiceDate > r.lastDate) r.lastDate = d.invoiceDate;
    map.set(d.key, r);
  }
  const summary = [...map.values()].sort((a, b) => b.total - a.total);

  return NextResponse.json({
    success: true,
    summary,
    details,
    grandTotal: details.reduce((s, d) => s + d.amount, 0),
    count: details.length,
  });
}
