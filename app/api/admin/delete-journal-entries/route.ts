import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  // Only superAdmin can delete journal entries
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح لك بهذه العملية" }, { status: 403 });
  }

  try {
    const { entryNumbers } = await request.json();

    if (!entryNumbers || !Array.isArray(entryNumbers) || entryNumbers.length === 0) {
      return NextResponse.json({ success: false, error: "يجب تحديد أرقام القيود للحذف" }, { status: 400 });
    }

    const result = await prisma.journalEntry.updateMany({
      where: {
        number: {
          in: entryNumbers
        }
      },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    });

    // Get deleted entries details
    const deletedEntries = await prisma.journalEntry.findMany({
      where: {
        number: {
          in: entryNumbers
        }
      },
      select: {
        id: true,
        number: true,
        descriptionAr: true,
        isDeleted: true,
        deletedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      deletedEntries
    });

  } catch (error) {
    console.error('Error deleting journal entries:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "فشل في حذف القيود"
    }, { status: 500 });
  }
}
