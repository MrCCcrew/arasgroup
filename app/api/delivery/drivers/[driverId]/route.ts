import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ driverId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  civilId: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportExpiryDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  baseSalary: z.number().optional().nullable(),
  residencyNumber: z.string().optional().nullable(),
  residencyExpiry: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  healthCardExpiryDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  licenseNumber: z.string().optional().nullable(),
  licenseExpiry: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  residentialAddress: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  assignedAt: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  talabatId: z.string().optional().nullable(),
  roPopsId: z.string().optional().nullable(),
  isRegisteredTalabat: z.boolean().optional(),
  isRegisteredRoPops: z.boolean().optional(),
  targetOrders: z.number().int().min(0).optional(),
  fuelCardNumber: z.string().optional().nullable(),
  assignedVehicleId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { driverId } = await params;
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        employee: {
          select: {
            nameAr: true,
            nameEn: true,
            phone: true,
            nationality: true,
            civilId: true,
            passportNumber: true,
            passportExpiryDate: true,
            dateOfBirth: true,
            baseSalary: true,
            residencyNumber: true,
            residencyExpiry: true,
            healthCardExpiryDate: true,
            licenseNumber: true,
            licenseExpiry: true,
            residentialAddress: true,
          },
        },
        assignedVehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
          },
        },
        vehicleAssignments: {
          where: { isActive: true },
          select: { assignedFrom: true },
          take: 1,
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ success: false, error: "السائق غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: driver });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب البيانات" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { driverId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const {
      talabatId,
      roPopsId,
      isRegisteredTalabat,
      isRegisteredRoPops,
      targetOrders,
      fuelCardNumber,
      assignedVehicleId,
      assignedAt,
      nameAr,
      nameEn,
      phone,
      nationality,
      civilId,
      passportNumber,
      passportExpiryDate,
      dateOfBirth,
      baseSalary,
      residencyNumber,
      residencyExpiry,
      healthCardExpiryDate,
      licenseNumber,
      licenseExpiry,
      residentialAddress,
    } = parsed.data;

    const driver = await prisma.$transaction(async (tx) => {
      const employeeData: Record<string, unknown> = {};
      if (nameAr !== undefined) employeeData.nameAr = nameAr;
      if (nameEn !== undefined) employeeData.nameEn = nameEn;
      if (phone !== undefined) employeeData.phone = phone;
      if (nationality !== undefined) employeeData.nationality = nationality;
      if (civilId !== undefined) employeeData.civilId = civilId;
      if (passportNumber !== undefined) employeeData.passportNumber = passportNumber;
      if (passportExpiryDate !== undefined) employeeData.passportExpiryDate = passportExpiryDate;
      if (baseSalary !== undefined) employeeData.baseSalary = baseSalary;
      if (residencyNumber !== undefined) employeeData.residencyNumber = residencyNumber;
      if (residencyExpiry !== undefined) employeeData.residencyExpiry = residencyExpiry;
      if (healthCardExpiryDate !== undefined) employeeData.healthCardExpiryDate = healthCardExpiryDate;
      if (licenseNumber !== undefined) employeeData.licenseNumber = licenseNumber;
      if (licenseExpiry !== undefined) employeeData.licenseExpiry = licenseExpiry;
      if (residentialAddress !== undefined) employeeData.residentialAddress = residentialAddress;
      if (dateOfBirth !== undefined) employeeData.dateOfBirth = dateOfBirth;

      const currentDriver = await tx.driver.findUnique({
        where: { id: driverId },
        select: {
          employeeId: true,
          assignedVehicleId: true,
          employee: { select: { companyId: true } },
        },
      });

      if (!currentDriver) {
        throw new Error("السائق غير موجود");
      }

      if (Object.keys(employeeData).length > 0) {
        await tx.employee.update({
          where: { id: currentDriver.employeeId },
          data: employeeData,
        });
      }

      const driverData: Record<string, unknown> = {};
      if (talabatId !== undefined) driverData.talabatId = talabatId;
      if (roPopsId !== undefined) driverData.roPopsId = roPopsId;
      if (isRegisteredTalabat !== undefined) driverData.isRegisteredTalabat = isRegisteredTalabat;
      if (isRegisteredRoPops !== undefined) driverData.isRegisteredRoPops = isRegisteredRoPops;
      if (targetOrders !== undefined) driverData.targetOrders = targetOrders;
      if (fuelCardNumber !== undefined) driverData.fuelCardNumber = fuelCardNumber;

      if (assignedVehicleId !== undefined) {
        if (assignedVehicleId) {
          const vehicle = await tx.vehicle.findFirst({
            where: {
              id: assignedVehicleId,
              isActive: true,
            },
            select: { id: true, plateNumber: true },
          });

          if (!vehicle) {
            throw new Error("المركبة المختارة غير موجودة أو غير نشطة");
          }

          const conflictingDriver = await tx.driver.findFirst({
            where: {
              id: { not: driverId },
              assignedVehicleId,
              employee: { isActive: true, isDeleted: false },
            },
            select: { employee: { select: { nameAr: true } } },
          });

          if (conflictingDriver) {
            throw new Error(`المركبة مخصصة حاليا للسائق ${conflictingDriver.employee.nameAr}`);
          }

          driverData.assignedVehicleId = vehicle.id;
          driverData.vehiclePlateNumberSnapshot = vehicle.plateNumber;
        } else {
          driverData.assignedVehicleId = null;
          driverData.vehiclePlateNumberSnapshot = null;
        }
      }

      if (assignedVehicleId !== undefined && currentDriver.assignedVehicleId !== assignedVehicleId) {
        await tx.driverVehicleAssignment.updateMany({
          where: { driverId, isActive: true },
          data: { isActive: false, assignedTo: new Date() },
        });

        if (assignedVehicleId) {
          await tx.driverVehicleAssignment.create({
            data: {
              companyId: currentDriver.employee.companyId,
              driverId,
              vehicleId: assignedVehicleId,
              assignedFrom: assignedAt ?? new Date(),
              isActive: true,
              createdById: session.id,
              notes: "تحديث التعيين من ملف السائق",
            },
          });
        }
      }

      return tx.driver.update({
        where: { id: driverId },
        data: driverData,
        include: {
          employee: { select: { nameAr: true, nameEn: true, residencyExpiry: true } },
          assignedVehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: driver });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "فشل في التحديث";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { driverId } = await params;
    const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { employeeId: true } });
    if (!driver) {
      return NextResponse.json({ success: false, error: "السائق غير موجود" }, { status: 404 });
    }

    await prisma.employee.update({
      where: { id: driver.employeeId },
      data: { isActive: false, isDeleted: true, deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
