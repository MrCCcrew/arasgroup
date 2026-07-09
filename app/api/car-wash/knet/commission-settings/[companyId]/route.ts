import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    const settings = await prisma.knetCommissionSettings.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        cardType: true,
        percentageRate: true,
        fixedAmount: true,
      },
      orderBy: { cardType: "asc" },
    });

    // Convert to map for easy lookup
    const settingsMap = Object.fromEntries(
      settings.map((s) => [
        s.cardType,
        {
          percentage: Number(s.percentageRate),
          fixed: Number(s.fixedAmount),
        },
      ])
    );

    return NextResponse.json({ success: true, data: settingsMap });
  } catch (error) {
    console.error("Get commission settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch commission settings" },
      { status: 500 }
    );
  }
}
