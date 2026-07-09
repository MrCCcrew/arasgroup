import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

const updateSchema = z.object({
  companyId: z.string(),
  changes: z.record(z.string(), z.string()), // { transactionId: cardType }
});

export async function PATCH(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { companyId, changes } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const transactionIds = Object.keys(changes);

    if (transactionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No changes provided" },
        { status: 400 }
      );
    }

    // Verify all transactions belong to company and are not settled
    const transactions = await prisma.knetTransaction.findMany({
      where: {
        id: { in: transactionIds },
        operation: { companyId },
        isSettled: false,
      },
      select: { id: true },
    });

    if (transactions.length !== transactionIds.length) {
      return NextResponse.json(
        { success: false, error: "بعض المعاملات غير موجودة أو مسواة بالفعل" },
        { status: 400 }
      );
    }

    // Update card types
    const updateOperations = transactionIds.map((id) =>
      prisma.knetTransaction.update({
        where: { id },
        data: { cardType: changes[id] },
      })
    );

    await prisma.$transaction(updateOperations);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "BULK_UPDATE_KNET_CARD_TYPES",
        module: "car_wash",
        resourceType: "KnetTransaction",
        resourceId: companyId,
        newValues: {
          count: transactionIds.length,
          changes,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({
      success: true,
      data: { updated: transactionIds.length },
    });
  } catch (error) {
    console.error("Bulk update card type error:", error);
    const message = error instanceof Error ? error.message : "Failed to update";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
