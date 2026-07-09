import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

const settingSchema = z.object({
  id: z.string().optional(),
  cardType: z.string(),
  percentageRate: z.number().min(0).max(100),
  fixedAmount: z.number().min(0),
});

const postSchema = z.object({
  companyId: z.string(),
  settings: z.array(settingSchema),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
    }

    const settings = await prisma.knetCommissionSettings.findMany({
      where: { companyId },
      orderBy: { cardType: "asc" },
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Get commission settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { companyId, settings } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // Upsert each setting
    const operations = settings.map((setting) =>
      prisma.knetCommissionSettings.upsert({
        where: {
          companyId_cardType: {
            companyId,
            cardType: setting.cardType,
          },
        },
        create: {
          companyId,
          cardType: setting.cardType,
          percentageRate: setting.percentageRate,
          fixedAmount: setting.fixedAmount,
        },
        update: {
          percentageRate: setting.percentageRate,
          fixedAmount: setting.fixedAmount,
        },
      })
    );

    await prisma.$transaction(operations);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "UPDATE_KNET_COMMISSION_SETTINGS",
        module: "car_wash",
        resourceType: "KnetCommissionSettings",
        resourceId: companyId,
        newValues: { count: settings.length },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true, data: { updated: settings.length } });
  } catch (error) {
    console.error("KNET commission settings error:", error);
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
