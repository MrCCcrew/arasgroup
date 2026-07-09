import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

const CARD_TYPES = ["KNET", "VISA_LOCAL", "VISA_INTL", "MASTERCARD_LOCAL", "MASTERCARD_INTL"] as const;

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const formData = await request.formData();
    const companyId = formData.get("companyId") as string;

    if (!companyId) {
      return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // Process each card type
    const operations = [];

    for (const cardType of CARD_TYPES) {
      const id = formData.get(`${cardType}_id`) as string;
      const percentageStr = formData.get(`${cardType}_percentage`) as string;
      const fixedStr = formData.get(`${cardType}_fixed`) as string;

      const percentage = parseFloat(percentageStr || "0");
      const fixed = parseFloat(fixedStr || "0");

      if (id) {
        // Update existing
        operations.push(
          prisma.knetCommissionSettings.update({
            where: { id },
            data: {
              percentageRate: percentage,
              fixedAmount: fixed,
            },
          })
        );
      } else {
        // Create new
        operations.push(
          prisma.knetCommissionSettings.upsert({
            where: {
              companyId_cardType: {
                companyId,
                cardType,
              },
            },
            create: {
              companyId,
              cardType,
              percentageRate: percentage,
              fixedAmount: fixed,
            },
            update: {
              percentageRate: percentage,
              fixedAmount: fixed,
            },
          })
        );
      }
    }

    await prisma.$transaction(operations);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "UPDATE_KNET_COMMISSION_SETTINGS",
        module: "car_wash",
        resourceType: "KnetCommissionSettings",
        resourceId: companyId,
        newValues: {
          companyId,
          cardTypes: CARD_TYPES,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.redirect(new URL(`/dashboard/companies/${companyId}/car-wash/knet`, request.url));
  } catch (error) {
    console.error("KNET commission settings error:", error);
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
