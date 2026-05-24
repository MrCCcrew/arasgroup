import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";
import {
  findVehicleIdentityConflict,
  getVehicleUniqueConstraintMessage,
  normalizeVehicleString,
} from "@/lib/vehicle-validation";

const carWashVehicleSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  clientGeneratedId: z.string().optional(),
  code: z.string().min(1, "الكود مطلوب"),
  nameAr: z.string().min(2, "الاسم العربي مطلوب"),
  nameEn: z.string().optional(),
  plateNumber: z.string().min(1, "رقم اللوحة مطلوب"),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  color: z.string().optional(),
  knetDeviceId: z.string().optional(),
  registrationBookNumber: z.string().optional(),
  registrationExpiry: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  insuranceExpiry: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  municipalityCardNumber: z.string().optional(),
  municipalityCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  advertisingCardNumber: z.string().optional(),
  advertisingCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  foodLicenseNumber: z.string().optional(),
  foodLicenseExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  fuelCardNumber: z.string().optional(),
  chassisNumber: z.string().optional(),
  notes: z.string().optional(),
  assignedDriverEmployeeId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const branchIds = getAccessibleBranchIds(session, companyId);

    const vehicles = await prisma.carWashVehicle.findMany({
      where: {
        companyId,
        ...(branchIds.length ? { branchId: { in: branchIds } } : {}),
      },
      include: {
        vehicle: true,
        workers: {
          include: {
            employee: { select: { nameAr: true, employmentStatus: true } },
          },
        },
        assignedWorkers: {
          include: {
            employee: { select: { id: true, nameAr: true, employmentStatus: true } },
          },
        },
        assetCustodies: {
          where: { status: "ACTIVE" },
          include: { assetItem: { select: { nameAr: true, serialNumber: true, status: true } } },
        },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, data: vehicles });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب مركبات الغسيل" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = carWashVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "CREATE", { companyId: data.companyId, branchId: data.branchId });
    if (permissionError) return permissionError;

    const plateNumber = normalizeVehicleString(data.plateNumber);
    const fuelCardNumber = normalizeVehicleString(data.fuelCardNumber) ?? undefined;

    if (!plateNumber) {
      return NextResponse.json({ success: false, error: "رقم اللوحة مطلوب" }, { status: 400 });
    }

    const conflictMessage = await findVehicleIdentityConflict({
      companyId: data.companyId,
      plateNumber,
      fuelCardNumber,
    });
    if (conflictMessage) {
      return NextResponse.json({ success: false, error: conflictMessage }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          clientGeneratedId: data.clientGeneratedId,
          plateNumber,
          make: data.make,
          model: data.model,
          year: data.year,
          color: data.color,
          type: "CAR_WASH",
          isActive: true,
          fuelCardNumber,
          registrationBookNumber: data.registrationBookNumber,
          registrationExpiry: data.registrationExpiry,
          insuranceExpiry: data.insuranceExpiry,
          municipalityCardNumber: data.municipalityCardNumber,
          municipalityCardExpiryDate: data.municipalityCardExpiryDate,
          advertisingCardNumber: data.advertisingCardNumber,
          advertisingCardExpiryDate: data.advertisingCardExpiryDate,
          foodLicenseNumber: data.foodLicenseNumber,
          foodLicenseExpiryDate: data.foodLicenseExpiryDate,
          chassisNumber: data.chassisNumber,
          notes: data.notes,
        },
      });

      const carWashVehicle = await tx.carWashVehicle.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          clientGeneratedId: data.clientGeneratedId,
          vehicleId: vehicle.id,
          code: data.code,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          knetDeviceId: data.knetDeviceId,
          isActive: true,
        },
        include: { vehicle: true },
      });

      if (data.assignedDriverEmployeeId) {
        const assignedDriver = await tx.carWashWorker.findFirst({
          where: {
            employeeId: data.assignedDriverEmployeeId,
            companyId: data.companyId,
            role: { in: ["DRIVER", "CAR_WASH_DRIVER"] },
          },
          select: { id: true },
        });

        if (!assignedDriver) {
          throw new Error("السائق المختار غير موجود ضمن سائقي شركة الغسيل");
        }

        await tx.carWashWorker.updateMany({
          where: {
            companyId: data.companyId,
            assignedCarWashVehicleId: carWashVehicle.id,
            role: { in: ["DRIVER", "CAR_WASH_DRIVER"] },
          },
          data: { assignedCarWashVehicleId: null },
        });

        await tx.carWashWorker.update({
          where: { id: assignedDriver.id },
          data: { assignedCarWashVehicleId: carWashVehicle.id },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          companyId: data.companyId,
          branchId: data.branchId,
          action: "CREATE_CAR_WASH_VEHICLE",
          module: "vehicles",
          resourceId: carWashVehicle.id,
          resourceType: "CarWashVehicle",
          newValues: { code: data.code, plateNumber },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return carWashVehicle;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const uniqueMessage = getVehicleUniqueConstraintMessage(error);
    if (uniqueMessage) {
      return NextResponse.json({ success: false, error: uniqueMessage }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "فشل في إضافة مركبة الغسيل";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
