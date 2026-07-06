import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";
import type { SyncStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

const syncItemSchema = z.object({
  clientId: z.string(),
  deviceId: z.string(),
  operation: z.enum(["CREATE", "UPDATE", "DELETE"]),
  module: z.string(),
  entityType: z.string(),
  entityId: z.string().optional(),
  payload: z.record(z.unknown()),
  clientTimestamp: z.string().transform((s) => new Date(s)),
});

const syncRequestSchema = z.object({
  companyId: z.string(),
  items: z.array(syncItemSchema),
});

/** GET — fetch pending sync items for client */
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status") ?? "PENDING";

    const items = await prisma.syncQueue.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(companyId ? { companyId } : {}),
        status: status as SyncStatus,
      },
      orderBy: { clientTimestamp: "asc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب قائمة المزامنة" }, { status: 500 });
  }
}

/** POST — upload offline transactions for sync */
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, items } = parsed.data;
    const results: Array<{ clientId: string; status: string; error?: string }> = [];

    for (const item of items) {
      try {
        // Check for duplicate (idempotency)
        const existing = await prisma.syncQueue.findFirst({
          where: { clientId: item.clientId },
        });

        if (existing) {
          results.push({ clientId: item.clientId, status: existing.status });
          continue;
        }

        await prisma.syncQueue.create({
          data: {
            clientId: item.clientId,
            deviceId: item.deviceId,
            userId,
            companyId,
            operation: item.operation,
            module: item.module,
            entityType: item.entityType,
            entityId: item.entityId,
            payload: item.payload as Prisma.InputJsonValue,
            status: "PENDING",
            clientTimestamp: item.clientTimestamp,
          },
        });

        // Process the sync item
        await processSyncItem(item, companyId, userId);
        results.push({ clientId: item.clientId, status: "SYNCED" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "خطأ غير معروف";
        await prisma.syncQueue.updateMany({
          where: { clientId: item.clientId },
          data: { status: "FAILED", error: errorMsg, retryCount: { increment: 1 } },
        });
        results.push({ clientId: item.clientId, status: "FAILED", error: errorMsg });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في المزامنة" }, { status: 500 });
  }
}

/** Process a single sync item */
async function processSyncItem(
  item: z.infer<typeof syncItemSchema>,
  companyId: string,
  userId: string
): Promise<void> {
  const { operation, module, entityType, entityId, payload } = item;

  // Mark as processing
  await prisma.syncQueue.updateMany({
    where: { clientId: item.clientId },
    data: { status: "PROCESSING" },
  });

  // Route to appropriate handler
  // In production, this would be a more complete routing system
  // For now, we handle basic cases
  switch (`${module}:${entityType}`) {
    case "delivery:DeliveryDailyOrder": {
      if (operation === "CREATE") {
        const p = payload as { driverId: string; contractId: string; date: string; ordersCount: number; tips?: number };
        await prisma.deliveryDailyOrder.create({
          data: {
            driverId: p.driverId,
            contractId: p.contractId,
            companyId,
            date: new Date(p.date),
            ordersCount: p.ordersCount,
            tips: p.tips,
          },
        });
      }
      break;
    }
    case "car_wash:CarWashDailyOperation": {
      // Handle via the operations API logic
      break;
    }
    case "expenses:Expense": {
      // Handle via the expenses API logic
      break;
    }
  }

  // Mark as synced
  await prisma.syncQueue.updateMany({
    where: { clientId: item.clientId },
    data: { status: "SYNCED", syncedAt: new Date() },
  });
}
