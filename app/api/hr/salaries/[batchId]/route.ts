import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess, assertPermission } from "@/lib/auth/access";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Ctx {
  params: Promise<{ batchId: string }>;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;

    const batch = await prisma.salaryBatch.findUnique({
      where: { id: batchId },
      include: {
        payments: {
          include: {
            employee: {
              select: {
                id: true,
                nameAr: true,
                nameEn: true,
                type: true,
                phone: true,
                baseSalary: true,
                employeeNumber: true,
              },
            },
          },
          orderBy: [{ employee: { type: "asc" } }, { employee: { nameAr: "asc" } }],
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ success: false, error: "دفعة الرواتب غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    return NextResponse.json({ success: true, data: batch });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب تفاصيل دفعة الرواتب" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(["DRAFT", "APPROVED", "PAID", "CANCELLED"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { batchId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const batch = await prisma.salaryBatch.findUnique({
      where: { id: batchId },
      select: { companyId: true, status: true, journalEntryId: true },
    });
    if (!batch) {
      return NextResponse.json({ success: false, error: "دفعة الرواتب غير موجودة" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, batch.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "SALARIES", "UPDATE", { companyId: batch.companyId });
    if (permissionError) return permissionError;

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === "CANCELLED" && batch.journalEntryId) {
        await discardLinkedJournalEntry(tx, batch.journalEntryId, {
          userId: session.id,
          reasonAr: "تم إلغاء دفعة الرواتب قبل ترحيل القيد",
        });
      }

      return tx.salaryBatch.update({
        where: { id: batchId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تحديث دفعة الرواتب" }, { status: 500 });
  }
}
