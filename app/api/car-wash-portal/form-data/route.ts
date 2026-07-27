import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const context = await getCarWashPortalContext(session);
  if (!context) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  const vehicleWhere = { companyId: context.companyId, isActive: true, ...(context.assignedVehicleId ? { id: context.assignedVehicleId } : {}) };
  const [vehicles, categories] = await Promise.all([
    prisma.carWashVehicle.findMany({ where: vehicleWhere, select: { id: true, code: true, nameAr: true, nameEn: true }, orderBy: { code: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: context.companyId, isActive: true }, select: { id: true, nameAr: true, nameEn: true, type: true, code: true }, orderBy: { nameAr: "asc" } }),
  ]);
  return NextResponse.json({ success: true, data: { vehicles, categories } });
}
