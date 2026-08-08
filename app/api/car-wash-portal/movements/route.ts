import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { requireRequestSession } from "@/lib/auth/access";
import { carWashDriverMovementScope } from "@/lib/car-wash/driver-movement-scope";

const inputSchema = z.object({
  kind: z.enum(["EXPENSE", "CASH", "KNET"]), vehicleId: z.string(), categoryId: z.string().optional(), amount: z.number().positive(), date: z.string().transform((value) => new Date(value)), notes: z.string().max(2000).optional(), imageUrl: z.string().url().optional(), ocrRawText: z.string().max(20000).optional(), transactionReference: z.string().max(191).optional(),
});

const day = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
const asAmount = (amount: { toString(): string } | number) => Number(amount.toString());
const dateFilter = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const context = await getCarWashPortalContext(session);
  if (!context) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedVehicleId = searchParams.get("vehicleId");
  const vehicleId = context.assignedVehicleId ?? requestedVehicleId ?? undefined;
  const kind = searchParams.get("kind");
  const from = dateFilter(searchParams.get("from"));
  const to = dateFilter(searchParams.get("to"));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const operationWhere = { companyId: context.companyId, ...(vehicleId ? { vehicleId } : {}) };
  const dateWhere = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const commonInclude = { operation: { include: { vehicle: { select: { id: true, code: true, nameAr: true, nameEn: true } } } }, createdBy: { select: { id: true, nameAr: true, nameEn: true, email: true } } } as const;

  const [expenses, revenues] = await Promise.all([
    kind && kind !== "EXPENSE" ? Promise.resolve([]) : prisma.carWashExpense.findMany({ where: { ...carWashDriverMovementScope(context.employeeId, context.companyId), operation: operationWhere, ...(from || to ? { date: dateWhere } : {}) }, include: commonInclude }),
    kind === "EXPENSE" ? Promise.resolve([]) : prisma.carWashRevenue.findMany({ where: { ...carWashDriverMovementScope(context.employeeId, context.companyId), operation: operationWhere, ...(kind === "CASH" || kind === "KNET" ? { type: kind } : {}), ...(from || to ? { date: dateWhere } : {}) }, include: commonInclude }),
  ]);
  const categoryIds = expenses.flatMap((expense) => expense.categoryId ? [expense.categoryId] : []);
  const categories = categoryIds.length ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, nameAr: true, nameEn: true } }) : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const movements = [
    ...expenses.map((expense) => ({ id: expense.id, kind: "EXPENSE" as const, date: expense.date, amount: asAmount(expense.amount), vehicle: expense.operation.vehicle, category: expense.categoryId ? categoryById.get(expense.categoryId) ?? null : null, paymentMethod: expense.paymentMethod, imageUrl: expense.imageUrl, notes: expense.description, source: expense.source, createdBy: expense.createdBy, createdAt: expense.createdAt })),
    ...revenues.map((revenue) => ({ id: revenue.id, kind: revenue.type as "CASH" | "KNET", date: revenue.date, amount: asAmount(revenue.amount), vehicle: revenue.operation.vehicle, category: null, paymentMethod: revenue.paymentMethod, imageUrl: revenue.imageUrl, notes: revenue.description, source: revenue.source, createdBy: revenue.createdBy, createdAt: revenue.createdAt })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime() || right.createdAt.getTime() - left.createdAt.getTime());

  return NextResponse.json({ success: true, data: movements.slice((page - 1) * pageSize, page * pageSize), page, total: movements.length, pageSize });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const context = await getCarWashPortalContext(session);
  if (!context) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  const data = parsed.data;
  const operationDate = day(data.date);
  const vehicle = await prisma.carWashVehicle.findFirst({ where: { id: data.vehicleId, companyId: context.companyId, isActive: true }, select: { id: true, branchId: true, code: true, nameAr: true, nameEn: true } });
  if (!vehicle || (context.assignedVehicleId && vehicle.id !== context.assignedVehicleId)) return NextResponse.json({ success: false, error: "Vehicle is not assigned to this account" }, { status: 403 });
  const location = await prisma.carWashLocation.findFirst({ where: { companyId: context.companyId, isActive: true }, select: { id: true } });
  if (!location) return NextResponse.json({ success: false, error: "No valid wash location is configured for this vehicle" }, { status: 400 });
  if (data.kind === "EXPENSE") {
    if (!data.categoryId) return NextResponse.json({ success: false, error: "Expense category is required" }, { status: 400 });
    const category = await prisma.expenseCategory.findFirst({ where: { id: data.categoryId, companyId: context.companyId }, select: { id: true, nameAr: true, nameEn: true } });
    if (!category) return NextResponse.json({ success: false, error: "Invalid expense category" }, { status: 400 });
  }
  if (data.kind === "KNET" && data.transactionReference) {
    const duplicate = await prisma.knetTransaction.findFirst({ where: { transactionRef: data.transactionReference, date: operationDate, amount: data.amount, operation: { vehicleId: vehicle.id } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ success: false, error: "Duplicate KNET transaction" }, { status: 409 });
  }

  const movement = await prisma.$transaction(async (tx) => {
    let operation = await tx.carWashDailyOperation.findUnique({ where: { vehicleId_date: { vehicleId: vehicle.id, date: operationDate } } });
    if (!operation) operation = await tx.carWashDailyOperation.create({ data: { vehicleId: vehicle.id, companyId: context.companyId, locationId: location.id, date: operationDate, notes: data.notes } });
    if (operation.companyId !== context.companyId || operation.locationId !== location.id) throw new Error("Operation location mismatch");
    if (data.kind === "EXPENSE") {
      const expense = await tx.carWashExpense.create({ data: { operationId: operation.id, categoryId: data.categoryId, amount: data.amount, description: data.notes ?? "Portal expense", date: operationDate, paymentMethod: "CASH", imageUrl: data.imageUrl, ocrRawText: data.ocrRawText, source: "CAR_WASH_PORTAL", createdById: context.userId, createdByEmployeeId: context.employeeId } });
      await tx.carWashDailyOperation.update({ where: { id: operation.id }, data: { totalExpenses: { increment: data.amount }, netRevenue: { decrement: data.amount } } });
      await tx.auditLog.create({ data: { userId: context.userId, companyId: context.companyId, branchId: context.branchId, action: "CREATE_CAR_WASH_PORTAL_EXPENSE", module: "car_wash", resourceId: expense.id, resourceType: "CarWashExpense" } });
      return { id: expense.id, kind: "EXPENSE", date: expense.date, amount: asAmount(expense.amount), vehicleId: vehicle.id, vehicle, source: expense.source };
    }
    const revenue = await tx.carWashRevenue.create({ data: { operationId: operation.id, type: data.kind, amount: data.amount, description: data.notes, date: operationDate, paymentMethod: data.kind, imageUrl: data.imageUrl, ocrRawText: data.ocrRawText, transactionReference: data.transactionReference, source: "CAR_WASH_PORTAL", createdById: context.userId, createdByEmployeeId: context.employeeId } });
    if (data.kind === "KNET") await tx.knetTransaction.create({ data: { operationId: operation.id, amount: data.amount, date: operationDate, transactionRef: data.transactionReference, cardType: "KNET" } });
    await tx.carWashDailyOperation.update({ where: { id: operation.id }, data: data.kind === "CASH" ? { totalCash: { increment: data.amount }, netRevenue: { increment: data.amount } } : { totalKnet: { increment: data.amount }, netRevenue: { increment: data.amount } } });
    await tx.auditLog.create({ data: { userId: context.userId, companyId: context.companyId, branchId: context.branchId, action: "CREATE_CAR_WASH_PORTAL_REVENUE", module: "car_wash", resourceId: revenue.id, resourceType: "CarWashRevenue" } });
    return { id: revenue.id, kind: revenue.type, date: revenue.date, amount: asAmount(revenue.amount), vehicleId: vehicle.id, vehicle, source: revenue.source };
  });

  return NextResponse.json({ success: true, data: movement }, { status: 201 });
}
