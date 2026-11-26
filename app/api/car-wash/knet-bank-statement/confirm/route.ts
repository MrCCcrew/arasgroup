import { NextRequest, NextResponse } from "next/server";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { takeCarWashKnetPreview } from "@/lib/car-wash/knet-bank-preview-store";

const KUWAIT_OFFSET = "+03:00";

function dayRange(date: Date) {
  const day = date.toISOString().slice(0, 10);
  return { gte: new Date(`${day}T00:00:00.000${KUWAIT_OFFSET}`), lte: new Date(`${day}T23:59:59.999${KUWAIT_OFFSET}`) };
}

// A bank statement is reconciliation evidence. It must not alter operational
// KNET revenue, settlement rows, daily totals, or accounting journal entries.
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { companyId, token } = await request.json();
    const access = assertCompanyAccess(session, companyId);
    if (access) return access;
    const preview = takeCarWashKnetPreview(token, companyId, session.id);
    if (!preview) return NextResponse.json({ success: false, error: "The preview expired. Upload the statement again." }, { status: 410 });

    const location = await prisma.carWashLocation.findFirst({ where: { companyId, isActive: true }, select: { id: true } });
    if (!location) return NextResponse.json({ success: false, error: "Create an active car-wash location before importing a statement." }, { status: 422 });

    const groups = new Map<string, { vehicleId: string; date: Date; amount: number; references: string[] }>();
    for (const row of preview.rows.filter((item) => item.status === "MATCHED" && item.vehicleId && item.transactionDate)) {
      const key = `${row.vehicleId}|${row.transactionDate!.toISOString().slice(0, 10)}`;
      const group = groups.get(key) ?? { vehicleId: row.vehicleId!, date: row.transactionDate!, amount: 0, references: [] };
      group.amount += Number(row.amount);
      if (row.transactionReference) group.references.push(row.transactionReference);
      groups.set(key, group);
    }

    let created = 0;
    let updated = 0;
    for (const group of groups.values()) {
      await prisma.$transaction(async (tx) => {
        const vehicle = await tx.carWashVehicle.findFirst({ where: { id: group.vehicleId, companyId }, select: { id: true, knetDeviceId: true } });
        if (!vehicle) return;
        let operation = await tx.carWashDailyOperation.findFirst({ where: { vehicleId: vehicle.id, date: dayRange(group.date) }, select: { id: true, date: true } });
        if (!operation) {
          operation = await tx.carWashDailyOperation.create({
            data: { companyId, vehicleId: vehicle.id, locationId: location.id, date: group.date, totalCash: 0, totalKnet: 0, totalExpenses: 0, netRevenue: 0, notes: "KNET bank reconciliation import" },
            select: { id: true, date: true },
          });
          created += 1;
        } else {
          updated += 1;
        }

        const reference = `BANKKNET:${vehicle.knetDeviceId ?? vehicle.id}:${operation.date.toISOString().slice(0, 10)}:${group.references.sort().join(",").slice(0, 120)}`;
        await tx.carWashBankKnetTransaction.upsert({
          where: { operationId_date: { operationId: operation.id, date: operation.date } },
          create: { operationId: operation.id, date: operation.date, amount: group.amount, transactionRef: reference },
          update: { amount: group.amount, transactionRef: reference },
        });
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "IMPORT_CAR_WASH_KNET_BANK_STATEMENT",
        module: "car_wash",
        resourceType: "CarWashBankKnetTransaction",
        resourceId: companyId,
        newValues: { created, updated, groups: groups.size },
        ipAddress: request.headers.get("x-forwarded-for") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });
    return NextResponse.json({ success: true, data: { created, updated, matchedGroups: groups.size } });
  } catch (error) {
    console.error("Car wash KNET statement confirmation failed", error);
    return NextResponse.json({ success: false, error: "Could not apply the KNET bank statement." }, { status: 500 });
  }
}
