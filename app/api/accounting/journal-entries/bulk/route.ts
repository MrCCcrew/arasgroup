import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

const bulkActionSchema = z.object({
  companyId: z.string(),
  entryIds: z.array(z.string()).min(1).max(100),
  action: z.enum(["approve", "post"]),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { companyId, entryIds, action } = parsed.data;

    // Check company access
    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // Verify all entries exist and belong to the company
    const entries = await prisma.journalEntry.findMany({
      where: {
        id: { in: entryIds },
        companyId,
        isDeleted: false,
      },
      select: { id: true, status: true, entryNumber: true },
    });

    if (entries.length !== entryIds.length) {
      return NextResponse.json(
        { success: false, error: "بعض القيود غير موجودة أو محذوفة" },
        { status: 404 }
      );
    }

    // Determine target status based on action
    let targetStatus: "APPROVED" | "POSTED";
    let allowedFromStatuses: string[];

    if (action === "approve") {
      targetStatus = "APPROVED";
      allowedFromStatuses = ["DRAFT", "PENDING_APPROVAL"];
    } else {
      // post
      targetStatus = "POSTED";
      allowedFromStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED"];
    }

    // Check if all entries can be updated
    const invalidEntries = entries.filter(
      (e) => !allowedFromStatuses.includes(e.status)
    );

    if (invalidEntries.length > 0) {
      const invalidNumbers = invalidEntries.map((e) => e.entryNumber).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن ${action === "approve" ? "اعتماد" : "ترحيل"} القيود التالية بسبب حالتها الحالية: ${invalidNumbers}`,
        },
        { status: 400 }
      );
    }

    // Perform bulk update
    const result = await prisma.journalEntry.updateMany({
      where: {
        id: { in: entryIds },
        companyId,
        isDeleted: false,
      },
      data: {
        status: targetStatus,
        ...(action === "approve"
          ? { approvedById: session.id, approvedAt: new Date() }
          : { postedById: session.id, postedAt: new Date() }),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: action === "approve" ? "BULK_APPROVE_JOURNAL_ENTRIES" : "BULK_POST_JOURNAL_ENTRIES",
        module: "accounting",
        resourceType: "JournalEntry",
        resourceId: entryIds[0], // First entry as reference
        newValues: {
          count: result.count,
          entryIds,
          targetStatus,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        updated: result.count,
        status: targetStatus,
      },
    });
  } catch (error) {
    console.error("Bulk journal entry action error:", error);
    const message = error instanceof Error ? error.message : "فشلت العملية";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
