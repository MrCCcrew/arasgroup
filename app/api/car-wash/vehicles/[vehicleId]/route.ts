import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess, assertPermission } from "@/lib/auth/access";
import { z } from "zod";
import {
  findVehicleIdentityConflict,
  getVehicleUniqueConstraintMessage,
  normalizeVehicleString,
} from "@/lib/vehicle-validation";

interface Props {
  params: Promise<{ vehicleId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional().nullable(),
  knetDeviceId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  assignedDriverEmployeeId: z.string().optional().nullable(),
  teamEmployeeIds: z.array(z.string()).max(20).optional(),
  plateNumber: z.string().optional(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable().transform((s) => (s ? new Date(s) : s === null ? null : undefined)),
  insuranceExpiry: z.string().optional().nullable().transform((s) => (s ? new Date(s) : s === null ? null : undefined)),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;

    const existing = await prisma.carWashVehicle.findUnique({
      where: { id: vehicleId },
      select: { companyId: true, branchId: true, vehicleId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });
    }

    const companyError = assertCompanyAccess(session, existing.companyId);
    if (companyError) return companyError;
    const permError = assertPermission(session, "VEHICLES", "UPDATE", { companyId: existing.companyId });
    if (permError) return permError;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const normalizedPlateNumber = normalizeVehicleString(parsed.data.plateNumber) ?? undefined;

    if (parsed.data.plateNumber !== undefined && !normalizedPlateNumber) {
      return NextResponse.json({ success: false, error: "رقم اللوحة مطلوب" }, { status: 400 });
    }

    const conflictMessage = await findVehicleIdentityConflict({
      companyId: existing.companyId,
      plateNumber: normalizedPlateNumber,
      excludeVehicleId: existing.vehicleId,
    });
    if (conflictMessage) {
      return NextResponse.json({ success: false, error: conflictMessage }, { status: 409 });
    }

    const { assignedDriverEmployeeId, teamEmployeeIds, nameAr, nameEn, knetDeviceId, isActive, make, model, color, registrationExpiry, insuranceExpiry, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      if (
        normalizedPlateNumber !== undefined ||
        make !== undefined ||
        model !== undefined ||
        color !== undefined ||
        registrationExpiry !== undefined ||
        insuranceExpiry !== undefined ||
        notes !== undefined
      ) {
        await tx.vehicle.update({
          where: { id: existing.vehicleId },
          data: {
            ...(normalizedPlateNumber !== undefined ? { plateNumber: normalizedPlateNumber } : {}),
            ...(make !== undefined ? { make } : {}),
            ...(model !== undefined ? { model } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(registrationExpiry !== undefined ? { registrationExpiry } : {}),
            ...(insuranceExpiry !== undefined ? { insuranceExpiry } : {}),
            ...(notes !== undefined ? { notes } : {}),
          },
        });
      }

      await tx.carWashVehicle.update({
        where: { id: vehicleId },
        data: {
          ...(nameAr !== undefined ? { nameAr } : {}),
          ...(nameEn !== undefined ? { nameEn } : {}),
          ...(knetDeviceId !== undefined ? { knetDeviceId } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        include: {
          vehicle: { select: { plateNumber: true, model: true, make: true, color: true, registrationExpiry: true, insuranceExpiry: true } },
        },
      });

      if (assignedDriverEmployeeId !== undefined) {
        await tx.carWashWorker.updateMany({
          where: {
            companyId: existing.companyId,
            assignedCarWashVehicleId: vehicleId,
            role: { in: ["DRIVER", "CAR_WASH_DRIVER"] },
          },
          data: { assignedCarWashVehicleId: null },
        });

        if (assignedDriverEmployeeId) {
          const assignedDriver = await tx.carWashWorker.findFirst({
            where: {
              employeeId: assignedDriverEmployeeId,
              companyId: existing.companyId,
              role: { in: ["DRIVER", "CAR_WASH_DRIVER"] },
            },
            select: { id: true },
          });

          if (!assignedDriver) {
            throw new Error("السائق المختار غير موجود ضمن سائقي شركة الغسيل");
          }

          await tx.carWashWorker.update({
            where: { id: assignedDriver.id },
            data: { assignedCarWashVehicleId: vehicleId },
          });
        }
      }

      if (teamEmployeeIds !== undefined) {
        const uniqueIds = [...new Set(teamEmployeeIds)];
        const team = uniqueIds.length
          ? await tx.carWashWorker.findMany({
              where: {
                employeeId: { in: uniqueIds },
                companyId: existing.companyId,
                role: { in: ["WASHER", "WASHING_WORKER", "SUPERVISOR", "OTHER"] },
              },
              select: { id: true },
            })
          : [];
        if (team.length !== uniqueIds.length) {
          throw new Error("أحد أعضاء الفريق المختارين غير موجود ضمن عمال الغسيل");
        }
        await tx.carWashWorker.updateMany({
          where: { companyId: existing.companyId, vehicleId },
          data: { vehicleId: null },
        });
        if (team.length) {
          await tx.carWashWorker.updateMany({
            where: { id: { in: team.map((worker) => worker.id) } },
            data: { vehicleId },
          });
        }
      }

      return tx.carWashVehicle.findUnique({
        where: { id: vehicleId },
        include: {
          vehicle: { select: { plateNumber: true, model: true, make: true, color: true, registrationExpiry: true, insuranceExpiry: true } },
          assignedWorkers: {
            include: {
              employee: { select: { id: true, nameAr: true, employmentStatus: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const uniqueMessage = getVehicleUniqueConstraintMessage(error);
    if (uniqueMessage) {
      return NextResponse.json({ success: false, error: uniqueMessage }, { status: 409 });
    }

    const msg = error instanceof Error ? error.message : "فشل في تحديث المركبة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;

    const existing = await prisma.carWashVehicle.findUnique({
      where: { id: vehicleId },
      select: { companyId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });
    }

    const companyError = assertCompanyAccess(session, existing.companyId);
    if (companyError) return companyError;
    const permError = assertPermission(session, "VEHICLES", "DELETE", { companyId: existing.companyId });
    if (permError) return permError;

    const opCount = await prisma.carWashDailyOperation.count({ where: { vehicleId } });
    if (opCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف المركبة - مرتبطة بـ ${opCount} عملية تشغيل` },
        { status: 400 }
      );
    }

    await prisma.carWashVehicle.update({ where: { id: vehicleId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف المركبة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
