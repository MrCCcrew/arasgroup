import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recomputeDriverWalletStates, syncDailyOrderWalletCharge } from "@/lib/delivery/wallet-state";
import { reconcileDriverChargeJEs } from "@/lib/delivery/charge-gl";
import { requireRequestSession } from "@/lib/auth/access";

const bulkEntrySchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  driverId: z.string(),
  ordersCount: z.number().int().min(0),
  operatedAsDriverId: z.string().optional().nullable(),
  workStatus: z.enum(["WORKED", "ON_LEAVE", "VEHICLE_BREAKDOWN", "NO_SHIFTS", "MISSED_SHIFT", "LATE_LOGIN", "ABSENT"]).optional(),
  ratePerOrder: z.number().min(0).optional(),
  grossAmount: z.number().min(0).optional(),
  walletDeducted: z.number().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  walletAmount: z.number().min(0).optional(),
});

const bulkCreateSchema = z.object({
  companyId: z.string(),
  contractId: z.string(),
  entries: z.array(bulkEntrySchema).min(1),
});

const buildWalletDescription = (date: Date) => `تحصيل يومي — ${date.toISOString().slice(0, 10)}`;

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json();
    const parsed = bulkCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, contractId, entries } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const saved: string[] = [];
      const failed: string[] = [];
      let totalWalletSaved = 0;
      const affectedDrivers = new Set<string>();

      for (const entry of entries) {
        try {
          const order = await tx.deliveryDailyOrder.upsert({
            where: {
              driverId_contractId_date: {
                driverId: entry.driverId,
                contractId,
                date: entry.date,
              },
            },
            create: {
              driverId: entry.driverId,
              operatedAsDriverId: entry.operatedAsDriverId ?? null,
              contractId,
              companyId,
              date: entry.date,
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
            date: entry.date,
            amount: entry.walletAmount,
            descriptionAr: buildWalletDescription(entry.date),
          });

          affectedDrivers.add(entry.driverId);
          if ((entry.walletAmount ?? 0) > 0) {
            totalWalletSaved++;
          }

          saved.push(entry.date.toISOString().slice(0, 10));
        } catch (error) {
          console.error(`Failed to save entry for date ${entry.date}:`, error);
          failed.push(entry.date.toISOString().slice(0, 10));
        }
      }

      await recomputeDriverWalletStates(tx, affectedDrivers);

      return {
        saved: saved.length,
        failed,
        walletSaved: totalWalletSaved,
        totalEntries: entries.length,
        affectedDriverIds: [...affectedDrivers],
      };
    });

    try {
      await reconcileDriverChargeJEs({ companyId, userId: session.id, driverIds: result.affectedDriverIds });
    } catch (glError) {
      console.error("charge GL reconcile failed:", glError);
    }

    if (result.failed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `فشل في حفظ ${result.failed.length} من ${result.totalEntries} يوم`,
          data: result,
        },
        { status: 207 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ البيانات";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
