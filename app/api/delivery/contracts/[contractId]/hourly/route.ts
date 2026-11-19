import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertBranchAccess, assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";
import { hourlyAmount, hourlyEntrySchema, hourlyRateSchema, parseWorkDate, resolveHourlyRate } from "@/lib/delivery/hourly-work";

type Context = { params: Promise<{ contractId: string }> };
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("entity"), id: z.string().optional(), name: z.string().trim().min(1).max(191), hourlyRate: hourlyRateSchema.nullable(), isActive: z.boolean().default(true) }),
  hourlyEntrySchema,
  z.object({ action: z.literal("deleteEntry"), id: z.string().min(1) }),
]);

export async function GET(request: NextRequest, { params }: Context) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { contractId } = await params;
  const contract = await prisma.deliveryContract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ success: false, error: "العقد غير موجود" }, { status: 404 });
  const denied = assertCompanyAccess(session, contract.companyId) || assertPermission(session, "DELIVERY_OPERATIONS", "VIEW", { companyId: contract.companyId });
  if (denied) return denied;
  const query = request.nextUrl.searchParams;
  const month = query.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ success: false, error: "اختر الشهر" }, { status: 400 });
  const start = parseWorkDate(`${month}-01`)!;
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const branchIds = getAccessibleBranchIds(session, contract.companyId);
  const where: Prisma.DeliveryHourlyWorkEntryWhereInput = {
    contractId, date: { gte: start, lt: end },
    ...(query.get("driverId") ? { driverId: query.get("driverId")! } : {}),
    ...(query.get("workEntityId") ? { workEntityId: query.get("workEntityId")! } : {}),
    ...(branchIds.length ? { driver: { employee: { branchId: { in: branchIds } } } } : {}),
  };
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.get("page")) || 1)));
  const [entities, entries, total, totals] = await Promise.all([
    prisma.deliveryWorkEntity.findMany({ where: { contractId }, orderBy: { name: "asc" } }),
    prisma.deliveryHourlyWorkEntry.findMany({ where, include: { driver: { select: { employee: { select: { nameAr: true, nameEn: true, employeeNumber: true } } } }, workEntity: { select: { name: true } } }, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 50 }),
    prisma.deliveryHourlyWorkEntry.count({ where }),
    prisma.deliveryHourlyWorkEntry.aggregate({ where, _sum: { minutes: true, amount: true, ordersCount: true } }),
  ]);
  return NextResponse.json({ success: true, data: { contract, entities, entries, total, page, totalMinutes: totals._sum.minutes ?? 0, totalOrders: totals._sum.ordersCount ?? 0, totalAmount: totals._sum.amount ?? "0.000" } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "راجع الجهة والسائق والتاريخ والساعات وسعر الساعة" }, { status: 400 });
  const input = parsed.data;
  const { contractId } = await params;
  const contract = await prisma.deliveryContract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ success: false, error: "العقد غير موجود" }, { status: 404 });
  const action = input.action === "deleteEntry" ? "DELETE" : input.id ? "UPDATE" : "CREATE";
  const denied = assertCompanyAccess(session, contract.companyId) || assertPermission(session, "DELIVERY_OPERATIONS", action, { companyId: contract.companyId });
  if (denied) return denied;
  if (!contract.isActive || !contract.usesHourlyWork) return NextResponse.json({ success: false, error: "فعّل نظام العمل بالساعة في عقد نشط أولًا" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      if (input.action === "entity") {
        const previous = input.id ? await tx.deliveryWorkEntity.findFirst({ where: { id: input.id, contractId } }) : null;
        if (input.id && !previous) throw new Error("الجهة غير موجودة في العقد");
        const data = { name: input.name, hourlyRate: input.hourlyRate, isActive: input.isActive };
        const entity = input.id ? await tx.deliveryWorkEntity.update({ where: { id: input.id }, data }) : await tx.deliveryWorkEntity.create({ data: { ...data, contractId } });
        await tx.auditLog.create({ data: { userId: session.id, companyId: contract.companyId, action: input.id ? "UPDATE_WORK_ENTITY" : "CREATE_WORK_ENTITY", module: "delivery", resourceType: "DeliveryWorkEntity", resourceId: entity.id, newValues: data } });
        return entity;
      }

      const previous = input.id ? await tx.deliveryHourlyWorkEntry.findFirst({ where: { id: input.id, contractId }, include: { driver: { select: { employee: { select: { branchId: true } } } } } }) : null;
      if (input.id && !previous) throw new Error("سجل الساعات غير موجود في العقد");
      if (previous?.driver.employee.branchId && assertBranchAccess(session, previous.driver.employee.branchId)) throw new Error("غير مصرح لهذا الفرع");
      if (input.action === "deleteEntry") {
        await tx.deliveryHourlyWorkEntry.delete({ where: { id: input.id } });
        await tx.auditLog.create({ data: { userId: session.id, companyId: contract.companyId, action: "DELETE_HOURLY_WORK", module: "delivery", resourceType: "DeliveryHourlyWorkEntry", resourceId: input.id, oldValues: { date: previous!.date.toISOString(), driverId: previous!.driverId, workEntityId: previous!.workEntityId, minutes: previous!.minutes, hourlyRate: previous!.hourlyRate.toString(), amount: previous!.amount.toString() } } });
        return { id: input.id };
      }
      const driver = await tx.driver.findFirst({ where: { id: input.driverId, employee: { companyId: contract.companyId, isDeleted: false, isActive: true } }, select: { id: true, employee: { select: { branchId: true } } } });
      if (!driver) throw new Error("السائق غير متاح في هذه الشركة");
      if (driver.employee.branchId && assertBranchAccess(session, driver.employee.branchId)) throw new Error("غير مصرح لهذا الفرع");
      // Serialize entries for a driver so concurrent requests cannot exceed 24h.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM drivers WHERE id = ${driver.id} FOR UPDATE`);
      const entity = await tx.deliveryWorkEntity.findFirst({ where: { id: input.workEntityId, contractId, isActive: true } });
      if (!entity) throw new Error("الجهة غير متاحة في هذا العقد");
      const date = parseWorkDate(input.date)!;
      if (date < new Date(contract.startDate.toISOString().slice(0, 10)) || (contract.endDate && date > new Date(contract.endDate.toISOString().slice(0, 10)))) throw new Error("تاريخ العمل خارج فترة العقد");
      const existingMinutes = await tx.deliveryHourlyWorkEntry.aggregate({ where: { driverId: driver.id, date, ...(input.id ? { id: { not: input.id } } : {}) }, _sum: { minutes: true } });
      if ((existingMinutes._sum.minutes ?? 0) + input.minutes > 1440) throw new Error("إجمالي ساعات السائق في اليوم لا يمكن أن يتجاوز 24 ساعة عبر كل الجهات والعقود");
      const rate = resolveHourlyRate(input.hourlyRate, previous, entity, contract.defaultHourlyRate);
      if (!rate) throw new Error("حدد سعر الساعة للعقد أو الجهة");
      const data = { driverId: driver.id, workEntityId: entity.id, date, minutes: input.minutes, ordersCount: input.ordersCount, hourlyRate: new Prisma.Decimal(rate), amount: hourlyAmount(input.minutes, rate), notes: input.notes || null };
      const entry = input.id ? await tx.deliveryHourlyWorkEntry.update({ where: { id: input.id }, data }) : await tx.deliveryHourlyWorkEntry.create({ data: { ...data, contractId, createdById: session.id } });
      await tx.auditLog.create({ data: { userId: session.id, companyId: contract.companyId, action: input.id ? "UPDATE_HOURLY_WORK" : "CREATE_HOURLY_WORK", module: "delivery", resourceType: "DeliveryHourlyWorkEntry", resourceId: entry.id, newValues: { ...data, date: date.toISOString(), hourlyRate: data.hourlyRate.toString(), amount: data.amount.toString() } } });
      return entry;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    return NextResponse.json({ success: false, error: duplicate ? "الاسم أو سجل السائق لهذه الجهة والتاريخ موجود بالفعل؛ عدّل السجل الحالي" : error instanceof Error ? error.message : "تعذر الحفظ" }, { status: duplicate ? 409 : 400 });
  }
}
