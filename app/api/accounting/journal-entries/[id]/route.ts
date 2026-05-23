import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { postJournalEntry, approveJournalEntry, deleteJournalEntry } from "@/lib/accounting/journal-engine";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const entry = await prisma.journalEntry.findUnique({
      where: { id, isDeleted: false },
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

    if (!entry) {
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
    const userId = session.id;
    const body = await request.json();
    const { action } = body;

    let entry;
    if (action === "post") {
      entry = await postJournalEntry(id, userId);
    } else if (action === "approve") {
      entry = await approveJournalEntry(id, userId);
    } else {
      return NextResponse.json({ success: false, error: "إجراء غير معروف" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث القيد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await params;
    const userId = session.id;
    await deleteJournalEntry(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف القيد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
