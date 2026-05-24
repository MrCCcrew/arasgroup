import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import {
  findVehicleIdentityConflict,
  getVehicleUniqueConstraintMessage,
  normalizeVehicleString,
} from "@/lib/vehicle-validation";

interface Props {
  params: Promise<{ vehicleId: string }>;
}

const updateSchema = z.object({
  branchId: z.string().optional().nullable(),
  investorId: z.string().optional().nullable(),
  licenseId: z.string().optional().nullable(),
  plateNumber: z.string().min(1).optional(),
  vehicleNumber: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  color: z.string().optional().nullable(),
  chassisNumber: z.string().optional().nullable(),
  ownershipModel: z.enum(["OWNER_OWNED", "RENTED"]).optional(),
  isActive: z.boolean().optional(),
  trackingDeviceId: z.string().optional().nullable(),
  fuelCardNumber: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  registrationExpiry: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  municipalityCardNumber: z.string().optional().nullable(),
  municipalityCardExpiryDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  advertisingCardNumber: z.string().optional().nullable(),
  advertisingCardExpiryDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, vehicle.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "UPDATE", { companyId: vehicle.companyId });
    if (permissionError) return permissionError;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const normalizedData = {
      ...parsed.data,
      plateNumber: normalizeVehicleString(parsed.data.plateNumber) ?? undefined,
      fuelCardNumber: normalizeVehicleString(parsed.data.fuelCardNumber),
    };

    if (parsed.data.plateNumber !== undefined && !normalizedData.plateNumber) {
      return NextResponse.json({ success: false, error: "رقم اللوحة مطلوب" }, { status: 400 });
    }

    const conflictMessage = await findVehicleIdentityConflict({
      companyId: vehicle.companyId,
      plateNumber: normalizedData.plateNumber,
      fuelCardNumber: normalizedData.fuelCardNumber,
      excludeVehicleId: vehicleId,
    });
    if (conflictMessage) {
      return NextResponse.json({ success: false, error: conflictMessage }, { status: 409 });
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: normalizedData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const uniqueMessage = getVehicleUniqueConstraintMessage(error);
    if (uniqueMessage) {
      return NextResponse.json({ success: false, error: uniqueMessage }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "فشل في تعديل المركبة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, vehicle.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "DELETE", { companyId: vehicle.companyId });
    if (permissionError) return permissionError;

    const [
      assignedDriversCount,
      fuelCardDriversCount,
      assignmentsCount,
      expensesCount,
      incidentsCount,
      assetCustodiesCount,
      carWashVehicleCount,
    ] = await Promise.all([
      prisma.driver.count({ where: { assignedVehicleId: vehicleId } }),
      prisma.driver.count({ where: { fuelCardLinkedVehicleId: vehicleId } }),
      prisma.driverVehicleAssignment.count({ where: { vehicleId } }),
      prisma.expense.count({ where: { vehicleId, isDeleted: false } }),
      prisma.vehicleIncident.count({ where: { OR: [{ vehicleId }, { replacementVehicleId: vehicleId }] } }),
      prisma.assetCustody.count({ where: { vehicleId } }),
      prisma.carWashVehicle.count({ where: { vehicleId } }),
    ]);

    const blockers = [
      assignedDriversCount ? `سائق حالي (${assignedDriversCount})` : null,
      fuelCardDriversCount ? `ربط بطاقة وقود مع سائق (${fuelCardDriversCount})` : null,
      assignmentsCount ? `سجل تعيين مركبة (${assignmentsCount})` : null,
      expensesCount ? `مصروف (${expensesCount})` : null,
      incidentsCount ? `حادث أو مركبة بديلة (${incidentsCount})` : null,
      assetCustodiesCount ? `عهدة أصل (${assetCustodiesCount})` : null,
      carWashVehicleCount ? `سجل غسيل سيارات (${carWashVehicleCount})` : null,
    ].filter(Boolean);

    if (blockers.length > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف المركبة - مرتبطة بـ ${blockers.join("، ")}` },
        { status: 409 }
      );
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف المركبة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
