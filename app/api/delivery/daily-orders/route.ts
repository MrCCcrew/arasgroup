import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { DeliveryDailyOrderWorkStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recomputeDriverWalletStates, syncDailyOrderWalletCharge } from "@/lib/delivery/wallet-state";

const entrySchema = z.object({
  driverId: z.string(),
  ordersCount: z.number().int().min(0),
  operatedAsDriverId: z.string().optional().nullable(),
  workStatus: z.enum(["WORKED", "ON_LEAVE", "VEHICLE_BREAKDOWN", "NO_SHIFTS", "MISSED_SHIFT", "LATE_LOGIN"]).optional(),
  ratePerOrder: z.number().min(0).optional(),
  grossAmount: z.number().min(0).optional(),
  walletDeducted: z.number().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  walletAmount: z.number().min(0).optional(),
});

const createSchema = z.object({
  companyId: z.string(),
  contractId: z.string(),
  dates: z.array(z.string()).min(1).transform((dates) => dates.map((d) => new Date(d))),
  entries: z.array(entrySchema).min(1),
});

const legacyCreateSchema = z.object({
  companyId: z.string(),
  contractId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  entries: z.array(entrySchema).min(1),
});

const buildWalletDescription = (date: Date) => `تحصيل يومي — ${date.toISOString().slice(0, 10)}`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const contractId = searchParams.get("contractId");
    const workStatus = searchParams.get("workStatus");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "25");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const where = {
      companyId,
      ...(contractId ? { contractId } : {}),
      ...(workStatus ? { workStatus: workStatus as DeliveryDailyOrderWorkStatus } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.deliveryDailyOrder.count({ where }),
      prisma.deliveryDailyOrder.findMany({
        where,
        include: {
          driver: { include: { employee: { select: { nameAr: true } } } },
          operatedAsDriver: { include: { employee: { select: { nameAr: true } } } },
          contract: { select: { nameAr: true, platform: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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
        return NextResponse.json({ success: false, error: newParsed.error.errors[0].message }, { status: 400 });
      }
      ({ companyId, contractId, entries } = legacyParsed.data);
      dates = [legacyParsed.data.date];
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalSaved = 0;
      let totalWalletSaved = 0;
      const affectedDrivers = new Set<string>();

      for (const date of dates) {
        for (const entry of entries) {
          const order = await tx.deliveryDailyOrder.upsert({
            where: { driverId_contractId_date: { driverId: entry.driverId, contractId, date } },
            create: {
              driverId: entry.driverId,
              operatedAsDriverId: entry.operatedAsDriverId ?? null,
              contractId,
              companyId,
              date,
              ordersCount: entry.ordersCount,
              workStatus: entry.workStatus ?? "WORKED",
              ratePerOrder: entry.ratePerOrder ?? null,
              grossAmount: entry.grossAmount ?? null,
              walletDeducted: entry.walletDeducted ?? null,
              rating: entry.rating ?? null,
              notes: entry.notes ?? null,
            },
            update: {
              ordersCount: entry.ordersCount,
              operatedAsDriverId: entry.operatedAsDriverId ?? null,
              workStatus: entry.workStatus ?? "WORKED",
              ratePerOrder: entry.ratePerOrder ?? null,
              grossAmount: entry.grossAmount ?? null,
              walletDeducted: entry.walletDeducted ?? null,
              rating: entry.rating ?? null,
              notes: entry.notes ?? null,
            },
          });

          await syncDailyOrderWalletCharge(tx, {
            dailyOrderId: order.id,
            driverId: entry.driverId,
            contractId,
            date,
            amount: entry.walletAmount,
            descriptionAr: buildWalletDescription(date),
          });

          affectedDrivers.add(entry.driverId);
          totalSaved++;
          if ((entry.walletAmount ?? 0) > 0) {
            totalWalletSaved++;
          }
        }
      }

      await recomputeDriverWalletStates(tx, affectedDrivers);

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
