import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const unsettled = searchParams.get("unsettled") === "true";

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const transactions = await prisma.knetTransaction.findMany({
      where: {
        isSettled: unsettled ? false : undefined,
        operation: { companyId },
      },
      include: {
        operation: {
          select: {
            date: true,
            vehicle: { select: { nameAr: true, code: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: transactions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب معاملات KNET" }, { status: 500 });
  }
}
