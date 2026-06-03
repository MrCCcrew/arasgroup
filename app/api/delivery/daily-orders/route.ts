import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const entrySchema = z.object({
  driverId: z.string(),
  ordersCount: z.number().int().min(0),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  walletAmount: z.number().min(0).optional(), // مبلغ التحصيل النقدي اليومي
});

const createSchema = z.object({
  companyId: z.string(),
  contractId: z.string(),
  dates: z.array(z.string()).min(1).transform((dates) => dates.map((d) => new Date(d))),
  entries: z.array(entrySchema).min(1),
});

// Legacy support for single date
const legacyCreateSchema = z.object({
  companyId: z.string(),
  contractId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  entries: z.array(entrySchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const contractId = searchParams.get("contractId");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "25");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const where = {
      companyId,
      ...(contractId ? { contractId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.deliveryDailyOrder.count({ where }),
      prisma.deliveryDailyOrder.findMany({
        where,
        include: {
          driver: { include: { employee: { select: { nameAr: true } } } },
          contract: { select: { nameAr: true, platform: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ success: true, data: { items, total, page, pageSize } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في جلب الأوردرات";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Try new format first (dates array), fallback to legacy (single date)
    let dates: Date[];
    let companyId: string;
    let contractId: string;
    let entries: z.infer<typeof entrySchema>[];

    const newParsed = createSchema.safeParse(body);
    if (newParsed.success) {
      ({ companyId, contractId, dates, entries } = newParsed.data);
    } else {
      const legacyParsed = legacyCreateSchema.safeParse(body);
      if (!legacyParsed.success) {
        return NextResponse.json(
          { success: false, error: newParsed.error.errors[0].message },
          { status: 400 }
        );
      }
      ({ companyId, contractId, entries } = legacyParsed.data);
      dates = [legacyParsed.data.date];
    }

    // حفظ الأوردرات + حركات المحفظة في transaction واحدة لجميع التواريخ
    const result = await prisma.$transaction(async (tx) => {
      let totalSaved = 0;
      let totalWalletSaved = 0;

      for (const date of dates) {
        // 1. upsert الأوردرات اليومية لهذا التاريخ
        const orderResults = await Promise.allSettled(
          entries.map((e) =>
            tx.deliveryDailyOrder.upsert({
              where: { driverId_contractId_date: { driverId: e.driverId, contractId, date } },
              create: {
                driverId: e.driverId,
                contractId,
                companyId,
                date,
                ordersCount: e.ordersCount,
                rating: e.rating ?? null,
                notes: e.notes ?? null,
              },
              update: {
                ordersCount: e.ordersCount,
                rating: e.rating ?? null,
                notes: e.notes ?? null,
              },
            })
          )
        );

        totalSaved += orderResults.filter((r) => r.status === "fulfilled").length;

        // 2. تسجيل حركات المحفظة (CHARGE) للسائقين اللي عندهم مبلغ تحصيل
        const walletEntries = entries.filter((e) => e.walletAmount && e.walletAmount > 0);

        for (const e of walletEntries) {
          await tx.driverWalletTransaction.create({
            data: {
              driverId: e.driverId,
              contractId,
              type: "CHARGE",
              amount: e.walletAmount!,
              date,
              descriptionAr: `تحصيل يومي — ${date.toISOString().slice(0, 10)}`,
            },
          });
          // تحديث رصيد المحفظة (CHARGE يزيد ما على السائق)
          await tx.driver.update({
            where: { id: e.driverId },
            data: { walletBalance: { increment: e.walletAmount! } },
          });
          totalWalletSaved++;
        }
      }

      return {
        saved: totalSaved,
        walletSaved: totalWalletSaved,
        datesCount: dates.length,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ الأوردرات";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
