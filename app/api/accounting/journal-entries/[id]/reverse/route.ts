import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { reverseJournalEntry } from "@/lib/accounting/journal-engine";

async function getEntryForAccess(id: string) {
  return prisma.journalEntry.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, companyId: true },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const permissionError = assertPermission(session, "ACCOUNTING", "UPDATE", { companyId: entry.companyId });
    if (permissionError) return permissionError;

    const reversalEntry = await reverseJournalEntry(id, session.id);

    return NextResponse.json({ success: true, data: reversalEntry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في عكس القيد";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
