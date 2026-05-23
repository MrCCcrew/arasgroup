import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds, hasPermission } from "@/lib/auth/permissions";

const driverSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  employeeNumber: z.string().optional(),
  nameAr: z.string().min(2, "الاسم العربي مطلوب"),
  nameEn: z.string().optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  phone: z.string().optional(),
  civilId: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  jobTitle: z.string().optional(),
  residentialAddress: z.string().optional(),
  ministryOfInteriorReferenceNumber: z.string().optional(),
  residencyNumber: z.string().optional(),
  residencyExpiry: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  licenseNumber: z.string().optional(),
  drivingLicenseExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  healthCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  municipalityCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  visaNumber: z.string().optional(),
  visaExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED", "EXITED"]).default("ACTIVE"),
  joinDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  endDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  baseSalary: z.number().optional(),
  notes: z.string().optional(),
  passportCustodyStatus: z.enum(["WITH_COMPANY", "WITH_DRIVER"]).default("WITH_DRIVER"),
  passportReceivedDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportReleasedDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportReleaseNotes: z.string().optional(),
  talabatId: z.string().optional(),
  roPopsId: z.string().optional(),
  isRegisteredTalabat: z.boolean().default(false),
  isRegisteredRoPops: z.boolean().default(false),
  assignedVehicleId: z.string().optional(),
  vehiclePlateNumberSnapshot: z.string().optional(),
  fuelCardNumber: z.string().optional(),
  isFuelCardLinkedToVehicle: z.boolean().default(false),
  fuelCardLinkedVehicleId: z.string().optional(),
  clientGeneratedId: z.string().optional(),
});

function validateDriverDates(data: z.infer<typeof driverSchema>) {
  if (data.passportIssueDate && data.passportExpiryDate && data.passportExpiryDate <= data.passportIssueDate) {
    throw new Error("تاريخ انتهاء الجواز يجب أن يكون بعد تاريخ الإصدار");
  }
}

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const platform = searchParams.get("platform");
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    if (
      !hasPermission(session, "DELIVERY_HR", "VIEW", { companyId }) &&
      !hasPermission(session, "DELIVERY_OPERATIONS", "VIEW", { companyId }) &&
      !hasPermission(session, "HR", "VIEW", { companyId })
    ) {
      return NextResponse.json({ success: false, error: "لا تملك الصلاحية المطلوبة" }, { status: 403 });
    }

    const branchIds = getAccessibleBranchIds(session, companyId);

    const drivers = await prisma.driver.findMany({
      where: {
        employee: {
          companyId,
          isActive: true,
          isDeleted: false,
          ...(branchIds.length ? { branchId: { in: branchIds } } : {}),
          ...(search ? { nameAr: { contains: search } } : {}),
          ...(status ? { employmentStatus: status as "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED" | "EXITED" } : {}),
        },
        ...(platform === "TALABAT" ? { isRegisteredTalabat: true } : {}),
        ...(platform === "RO_POPS" ? { isRegisteredRoPops: true } : {}),
      },
      include: {
        employee: true,
        assignedVehicle: {
          select: { id: true, plateNumber: true, make: true, model: true, fuelCardNumber: true, vehicleStatus: true },
        },
        vehicleAssignments: {
          where: { isActive: true },
          orderBy: { assignedFrom: "desc" },
          take: 1,
          include: { vehicle: { select: { plateNumber: true, make: true, model: true } } },
        },
      },
      orderBy: { employee: { nameAr: "asc" } },
    });

    return NextResponse.json({ success: true, data: drivers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب السائقين" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = driverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    validateDriverDates(data);

    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "DELIVERY_HR", "CREATE", { companyId: data.companyId, branchId: data.branchId });
    if (permissionError) return permissionError;

    if (data.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId }, select: { companyId: true } });
      if (!branch || branch.companyId !== data.companyId) {
        return NextResponse.json({ success: false, error: "الفرع غير صالح" }, { status: 400 });
      }
    }

    if (data.civilId) {
      const existingCivilId = await prisma.employee.findFirst({
        where: { companyId: data.companyId, civilId: data.civilId, isDeleted: false },
        select: { id: true },
      });
      if (existingCivilId) {
        return NextResponse.json({ success: false, error: "الرقم المدني مسجل بالفعل داخل الشركة" }, { status: 400 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      let assignedVehicleSnapshot = data.vehiclePlateNumberSnapshot;
      let linkedVehicleFuelCard = data.fuelCardNumber;

      if (data.assignedVehicleId) {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: data.assignedVehicleId, companyId: data.companyId },
          select: { id: true, plateNumber: true, fuelCardNumber: true, vehicleStatus: true, isActive: true },
        });

        if (!vehicle) throw new Error("المركبة المحددة غير موجودة داخل الشركة");
        if (!vehicle.isActive) throw new Error("لا يمكن تعيين مركبة غير نشطة");

        assignedVehicleSnapshot = assignedVehicleSnapshot ?? vehicle.plateNumber;
        linkedVehicleFuelCard = linkedVehicleFuelCard ?? vehicle.fuelCardNumber ?? undefined;
      }

      const employee = await tx.employee.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          clientGeneratedId: data.clientGeneratedId,
          employeeNumber: data.employeeNumber,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          type: "DELIVERY_DRIVER",
          nationality: data.nationality,
          dateOfBirth: data.dateOfBirth,
          civilId: data.civilId,
          passportNumber: data.passportNumber,
          passportIssueDate: data.passportIssueDate,
          passportExpiryDate: data.passportExpiryDate,
          residencyNumber: data.residencyNumber,
          residencyExpiry: data.residencyExpiry,
          ministryOfInteriorReferenceNumber: data.ministryOfInteriorReferenceNumber,
          healthCardExpiryDate: data.healthCardExpiryDate,
          municipalityCardExpiryDate: data.municipalityCardExpiryDate,
          visaNumber: data.visaNumber,
          visaExpiryDate: data.visaExpiryDate,
          licenseNumber: data.licenseNumber,
          licenseExpiry: data.drivingLicenseExpiryDate,
          phone: data.phone,
          jobTitle: data.jobTitle,
          residentialAddress: data.residentialAddress,
          employmentStatus: data.employmentStatus,
          joinDate: data.joinDate,
          endDate: data.endDate,
          baseSalary: data.baseSalary,
          notes: data.notes,
          passportCustodyStatus: data.passportCustodyStatus,
          passportReceivedDate: data.passportReceivedDate,
          passportReleasedDate: data.passportReleasedDate,
          passportReleaseNotes: data.passportReleaseNotes,
        },
      });

      const driver = await tx.driver.create({
        data: {
          employeeId: employee.id,
          clientGeneratedId: data.clientGeneratedId,
          talabatId: data.talabatId,
          roPopsId: data.roPopsId,
          isRegisteredTalabat: data.isRegisteredTalabat,
          isRegisteredRoPops: data.isRegisteredRoPops,
          assignedVehicleId: data.assignedVehicleId,
          vehiclePlateNumberSnapshot: assignedVehicleSnapshot,
          fuelCardNumber: linkedVehicleFuelCard,
          isFuelCardLinkedToVehicle: data.isFuelCardLinkedToVehicle,
          fuelCardLinkedVehicleId: data.fuelCardLinkedVehicleId,
        },
        include: {
          employee: true,
          assignedVehicle: true,
        },
      });

      if (data.assignedVehicleId) {
        const activeAssignment = await tx.driverVehicleAssignment.findFirst({
          where: { driverId: driver.id, isActive: true },
          select: { id: true },
        });
        if (activeAssignment) throw new Error("لا يمكن تعيين أكثر من مركبة نشطة للسائق");

        await tx.driverVehicleAssignment.create({
          data: {
            companyId: data.companyId,
            driverId: driver.id,
            vehicleId: data.assignedVehicleId,
            assignedFrom: data.joinDate ?? new Date(),
            isActive: true,
            createdById: session.id,
            notes: "تعيين أولي عند إنشاء السائق",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          companyId: data.companyId,
          branchId: data.branchId,
          action: "CREATE_DRIVER",
          module: "delivery_hr",
          resourceId: driver.id,
          resourceType: "Driver",
          newValues: {
            employeeId: employee.id,
            assignedVehicleId: data.assignedVehicleId,
            passportCustodyStatus: data.passportCustodyStatus,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return driver;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إضافة السائق";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
