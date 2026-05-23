import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry } from "@/lib/accounting/journal-engine";
import { z } from "zod";
import type { JournalStatus, JournalEntryType } from "@prisma/client";

const lineSchema = z.object({
  accountId: z.string(),
  descriptionAr: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  costCenterId: z.string().optional(),
  driverId: z.string().optional(),
  employeeId: z.string().optional(),
  investorId: z.string().optional(),
  branchId: z.string().optional(),
  carWashVehicleId: z.string().optional(),
});

const createJESchema = z.object({
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  descriptionAr: z.string().min(3, "الوصف مطلوب"),
  descriptionEn: z.string().optional(),
  type: z.enum([
    "GENERAL", "RECEIPT", "PAYMENT", "TRANSFER", "SALARY",
    "OPENING_BALANCE", "DEPRECIATION", "ADJUSTMENT",
    "DELIVERY_INCOME", "DELIVERY_WALLET", "CAR_WASH_REVENUE",
    "KNET_SETTLEMENT", "INVESTOR_COLLECTION",
    "INVESTOR_SALARY_COLLECTION", "INVESTOR_SALARY_DISBURSEMENT", "EXPENSE",
  ]),
  reference: z.string().optional(),
  costCenterId: z.string().optional(),
  lines: z.array(lineSchema).min(2, "يجب أن يحتوي القيد على سطرين على الأقل"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const fiscalYearId = searchParams.get("fiscalYearId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const where = {
      companyId,
      isDeleted: false,
      ...(fiscalYearId ? { fiscalYearId } : {}),
      ...(status ? { status: status as JournalStatus } : {}),
      ...(type ? { type: type as JournalEntryType } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: { select: { code: true, nameAr: true } } },
          },
          createdBy: { select: { nameAr: true } },
          costCenter: { select: { code: true, nameAr: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب القيود" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = createJESchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const entry = await createJournalEntry({
      ...parsed.data,
      createdById: userId,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        module: "accounting",
        resourceId: entry.id,
        resourceType: "JournalEntry",
        newValues: { number: entry.number, type: entry.type, total: entry.totalDebit },
        companyId: entry.companyId,
        journalEntryId: entry.id,
      },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء القيد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
