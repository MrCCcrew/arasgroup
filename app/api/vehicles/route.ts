import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import {
  findVehicleIdentityConflict,
  getVehicleUniqueConstraintMessage,
  normalizeVehicleString,
} from "@/lib/vehicle-validation";

const createVehicleSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  investorId: z.string().optional(),
  licenseId: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  plateNumber: z.string().min(1, "رقم اللوحة مطلوب"),
  vehicleNumber: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  color: z.string().optional(),
  chassisNumber: z.string().optional(),
  ownershipModel: z.enum(["OWNER_OWNED", "RENTED"]).default("OWNER_OWNED"),
  trackingDeviceId: z.string().optional(),
  fuelCardNumber: z.string().optional(),
  insuranceExpiry: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  registrationExpiry: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  municipalityCardNumber: z.string().optional(),
  municipalityCardExpiryDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  advertisingCardNumber: z.string().optional(),
  advertisingCardExpiryDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const type = searchParams.get("type");
    const activeOnly = searchParams.get("activeOnly") === "true";
    const availableForDriverId = searchParams.get("availableForDriverId");
    const groupWide = searchParams.get("groupWide") === "true";

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const normalizedType = type && ["DELIVERY", "CAR_WASH", "ADMIN"].includes(type) ? type : null;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(groupWide ? {} : { companyId }),
        ...(normalizedType ? { type: normalizedType as "DELIVERY" | "CAR_WASH" | "ADMIN" } : {}),
        ...(activeOnly ? { isActive: true } : {}),
        ...(availableForDriverId
          ? {
              OR: [
                { assignedDrivers: { none: { employee: { isActive: true, isDeleted: false } } } },
                { assignedDrivers: { some: { id: availableForDriverId } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        vehicleStatus: true,
        company: { select: { id: true, nameAr: true } },
      },
      orderBy: [{ company: { nameAr: "asc" } }, { plateNumber: "asc" }],
    });

    return NextResponse.json({ success: true, data: vehicles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في جلب المركبات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "VEHICLES", "CREATE", { companyId: data.companyId });
    if (permissionError) return permissionError;

    if (data.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: data.assignedEmployeeId,
          companyId: data.companyId,
          isActive: true,
          isDeleted: false,
          type: { in: ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB", "OFFICE_BOY", "OTHER"] },
        },
        select: { id: true },
      });

      if (!employee) {
        return NextResponse.json({ success: false, error: "الموظف المختار غير صالح كموظف إداري للمركبة" }, { status: 400 });
      }
    }

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

    const vehicle = await prisma.vehicle.create({
      data: {
        companyId: data.companyId,
        branchId: data.branchId,
        investorId: data.investorId,
        licenseId: data.licenseId,
        assignedEmployeeId: data.assignedEmployeeId,
        plateNumber,
        vehicleNumber: data.vehicleNumber,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color,
        chassisNumber: data.chassisNumber,
        ownershipModel: data.ownershipModel,
        trackingDeviceId: data.trackingDeviceId,
        fuelCardNumber: fuelCardNumber ?? null,
        insuranceExpiry: data.insuranceExpiry,
        registrationExpiry: data.registrationExpiry,
        municipalityCardNumber: data.municipalityCardNumber,
        municipalityCardExpiryDate: data.municipalityCardExpiryDate,
        advertisingCardNumber: data.advertisingCardNumber,
        advertisingCardExpiryDate: data.advertisingCardExpiryDate,
        notes: data.notes,
        type: "DELIVERY",
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId: data.companyId,
        action: "CREATE_VEHICLE",
        module: "vehicles",
        resourceId: vehicle.id,
        resourceType: "Vehicle",
        newValues: { plateNumber, assignedEmployeeId: data.assignedEmployeeId ?? null },
        ipAddress: request.headers.get("x-forwarded-for") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    const uniqueMessage = getVehicleUniqueConstraintMessage(error);
    if (uniqueMessage) {
      return NextResponse.json({ success: false, error: uniqueMessage }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "فشل في إضافة المركبة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
