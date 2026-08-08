import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { requireRequestSession } from "@/lib/auth/access";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  notes: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

type Params = { params: Promise<{ movementId: string }> };

async function contextFor(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const context = await getCarWashPortalContext(session);
  return context ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
}

async function findOwnedMovement(id: string, employeeId: string, companyId: string) {
  const expense = await prisma.carWashExpense.findFirst({
    where: { id, createdByEmployeeId: employeeId, operation: { companyId } },
    include: { operation: { select: { id: true, vehicleId: true, companyId: true } } },
  });
  if (expense) return { kind: "EXPENSE" as const, record: expense };
  const revenue = await prisma.carWashRevenue.findFirst({
    where: { id, createdByEmployeeId: employeeId, operation: { companyId } },
    include: { operation: { select: { id: true, vehicleId: true, companyId: true } } },
  });
  return revenue ? { kind: revenue.type, record: revenue } : null;
}

function responseMovement(movement: NonNullable<Awaited<ReturnType<typeof findOwnedMovement>>>) {
  return {
    id: movement.record.id,
    kind: movement.kind,
    date: movement.record.date,
    amount: Number(movement.record.amount.toString()),
    vehicleId: movement.record.operation.vehicleId,
    source: movement.record.source,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const context = await contextFor(request);
  if (context instanceof NextResponse) return context;
  const { movementId } = await params;
  const movement = await findOwnedMovement(movementId, context.employeeId, context.companyId);
  if (!movement) return NextResponse.json({ success: false, error: "Movement not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: responseMovement(movement) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const context = await contextFor(request);
  if (context instanceof NextResponse) return context;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  const { movementId } = await params;
  const movement = await findOwnedMovement(movementId, context.employeeId, context.companyId);
  if (!movement) return NextResponse.json({ success: false, error: "Movement not found" }, { status: 404 });
  if (movement.kind === "KNET" && parsed.data.amount !== undefined) {
    return NextResponse.json({ success: false, error: "KNET amount cannot be changed from the driver portal" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const amount = parsed.data.amount;
    if (movement.kind === "EXPENSE") {
      const record = await tx.carWashExpense.update({ where: { id: movement.record.id }, data: { amount, description: parsed.data.notes === undefined ? undefined : parsed.data.notes ?? "", imageUrl: parsed.data.imageUrl === undefined ? undefined : parsed.data.imageUrl, categoryId: parsed.data.categoryId === undefined ? undefined : parsed.data.categoryId } });
      if (amount !== undefined) await tx.carWashDailyOperation.update({ where: { id: movement.record.operationId }, data: { totalExpenses: { increment: amount - Number(movement.record.amount.toString()) }, netRevenue: { decrement: amount - Number(movement.record.amount.toString()) } } });
      return { kind: "EXPENSE" as const, record: { ...record, operation: movement.record.operation } };
    }
    const record = await tx.carWashRevenue.update({ where: { id: movement.record.id }, data: { description: parsed.data.notes === undefined ? undefined : parsed.data.notes, imageUrl: parsed.data.imageUrl === undefined ? undefined : parsed.data.imageUrl } });
    return { kind: movement.kind, record: { ...record, operation: movement.record.operation } };
  });
  return NextResponse.json({ success: true, data: responseMovement(updated) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const context = await contextFor(request);
  if (context instanceof NextResponse) return context;
  const { movementId } = await params;
  const movement = await findOwnedMovement(movementId, context.employeeId, context.companyId);
  if (!movement) return NextResponse.json({ success: false, error: "Movement not found" }, { status: 404 });
  if (movement.kind === "KNET" && !movement.record.transactionReference) {
    return NextResponse.json({ success: false, error: "KNET contribution without a reference must be handled by an administrator" }, { status: 409 });
  }
  await prisma.$transaction(async (tx) => {
    const amount = Number(movement.record.amount.toString());
    if (movement.kind === "EXPENSE") {
      await tx.carWashExpense.delete({ where: { id: movement.record.id } });
      await tx.carWashDailyOperation.update({ where: { id: movement.record.operationId }, data: { totalExpenses: { decrement: amount }, netRevenue: { increment: amount } } });
    } else {
      if (movement.kind === "KNET") {
        const knet = await tx.knetTransaction.findFirst({ where: { operationId: movement.record.operationId, transactionRef: movement.record.transactionReference!, amount: movement.record.amount, date: movement.record.date }, select: { id: true } });
        if (!knet) throw new Error("KNET transaction is missing");
        await tx.knetTransaction.delete({ where: { id: knet.id } });
      }
      await tx.carWashRevenue.delete({ where: { id: movement.record.id } });
      const totalField = movement.kind === "CASH" ? "totalCash" : "totalKnet";
      await tx.carWashDailyOperation.update({ where: { id: movement.record.operationId }, data: { [totalField]: { decrement: amount }, netRevenue: { decrement: amount } } });
    }
    await tx.auditLog.create({ data: { userId: context.userId, companyId: context.companyId, branchId: context.branchId, action: "DELETE_CAR_WASH_PORTAL_MOVEMENT", module: "car_wash", resourceId: movement.record.id, resourceType: movement.kind === "EXPENSE" ? "CarWashExpense" : "CarWashRevenue" } });
  });
  return NextResponse.json({ success: true });
}
