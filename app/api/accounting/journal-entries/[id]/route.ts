import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import {
  approveJournalEntry,
  cancelJournalEntry,
  deleteJournalEntry,
  postJournalEntry,
  rejectJournalEntry,
  revertJournalEntryToDraft,
  submitJournalEntryForApproval,
} from "@/lib/accounting/journal-engine";

async function getEntryForAccess(id: string) {
  return prisma.journalEntry.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, companyId: true },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const accessEntry = await getEntryForAccess(id);
    if (!accessEntry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, accessEntry.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "VIEW", { companyId: accessEntry.companyId });
    if (permissionError) return permissionError;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: { select: { code: true, nameAr: true, nameEn: true, type: true } },
            costCenter: { select: { code: true, nameAr: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        attachments: true,
        createdBy: { select: { id: true, nameAr: true } },
        approvedBy: { select: { id: true, nameAr: true } },
        costCenter: { select: { code: true, nameAr: true } },
        fiscalYear: { select: { year: true, isLocked: true } },
      },
    });

    if (!entry || entry.isDeleted) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب القيد" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const entry = await getEntryForAccess(id);
    if (!entry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, entry.companyId);
    if (companyAccessError) return companyAccessError;

    const { action } = await request.json();

    const actionPermission =
      action === "approve" || action === "reject" || action === "post"
        ? assertPermission(session, "ACCOUNTING", action === "post" ? "UPDATE" : "APPROVE", { companyId: entry.companyId })
        : assertPermission(session, "ACCOUNTING", "UPDATE", { companyId: entry.companyId });

    if (actionPermission) return actionPermission;

    const updatedEntry =
      action === "submit"
        ? await submitJournalEntryForApproval(id)
        : action === "approve"
        ? await approveJournalEntry(id, session.id)
        : action === "reject"
        ? await rejectJournalEntry(id)
        : action === "revert"
        ? await revertJournalEntryToDraft(id)
        : action === "cancel"
        ? await cancelJournalEntry(id)
        : action === "post"
        ? await postJournalEntry(id, session.id)
        : null;

    if (!updatedEntry) {
      return NextResponse.json({ success: false, error: "إجراء غير معروف" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تحديث القيد";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const entry = await getEntryForAccess(id);
    if (!entry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, entry.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "DELETE", { companyId: entry.companyId });
    if (permissionError) return permissionError;

    await deleteJournalEntry(id, session.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف القيد";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
