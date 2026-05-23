import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";

const employeeSchema = z.object({
  companyId: z.string(),
  branchId: z.string().optional(),
  licenseId: z.string().optional(),
  additionalLicenseIds: z.array(z.string()).optional(),
  clientGeneratedId: z.string().optional(),
  positionId: z.string().optional(),
  employeeNumber: z.string().optional(),
  nameAr: z.string().min(2, "الاسم العربي مطلوب"),
  nameEn: z.string().optional(),
  type: z.enum([
    "DRIVER",
    "DELIVERY_DRIVER",
    "DELIVERY_ADMIN",
    "CAR_WASH_DRIVER",
    "CAR_WASH_WORKER",
    "OFFICE_EMPLOYEE",
    "ACCOUNTANT",
    "MANDOUB",
    "OFFICE_BOY",
    "OTHER",
  ]),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  civilId: z.string().optional(),
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  residencyNumber: z.string().optional(),
  residencyExpiry: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  ministryOfInteriorReferenceNumber: z.string().optional(),
  healthCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  municipalityCardExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  visaNumber: z.string().optional(),
  visaExpiryDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  jobTitle: z.string().optional(),
  residentialAddress: z.string().optional(),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED", "EXITED"]).default("ACTIVE"),
  phone: z.string().optional(),
  joinDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  endDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  baseSalary: z.number().optional(),
  bankAccountNumber: z.string().optional(),
  passportCustodyStatus: z.enum(["WITH_COMPANY", "WITH_DRIVER"]).default("WITH_DRIVER"),
  passportReceivedDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportReleasedDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  passportReleaseNotes: z.string().optional(),
  notes: z.string().optional(),
  carWashWorkerRole: z
    .enum(["DRIVER", "WASHER", "CAR_WASH_DRIVER", "WASHING_WORKER", "SUPERVISOR", "OTHER"])
    .optional(),
  assignedCarWashVehicleId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const licenseId = searchParams.get("licenseId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const expiringResidency = searchParams.get("expiringResidency");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "HR", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const now = new Date();
    const expiryThreshold = expiringResidency
      ? new Date(now.getTime() + Number.parseInt(expiringResidency, 10) * 24 * 60 * 60 * 1000)
      : undefined;
    const branchIds = getAccessibleBranchIds(session, companyId);

    // فلتر الترخيص: الموظف الأساسي في الترخيص OR الموظف المرتبط به (إداري عابر)
    const licenseFilter = licenseId
      ? { OR: [{ licenseId }, { licenseAssignments: { some: { licenseId } } }] }
      : {};

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        isDeleted: false,
        ...(branchIds.length ? { branchId: { in: branchIds } } : {}),
        ...(type ? { type: type as z.infer<typeof employeeSchema>["type"] } : {}),
        ...(search ? { nameAr: { contains: search } } : {}),
        ...(expiryThreshold ? { residencyExpiry: { lte: expiryThreshold, gte: now } } : {}),
        ...licenseFilter,
      },
      include: {
        branch: { select: { id: true, nameAr: true } },
        license: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
        licenseAssignments: {
          select: { licenseId: true, license: { select: { commercialNameAr: true, licenseNumber: true } } },
        },
        driver: { select: { id: true, isRegisteredTalabat: true, isRegisteredRoPops: true } },
        carWashWorker: {
          select: {
            id: true,
            role: true,
            assignedCarWashVehicle: { select: { id: true, nameAr: true, code: true } },
          },
        },
      },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب الموظفين" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "HR", "CREATE", {
      companyId: data.companyId,
      branchId: data.branchId,
    });
    if (permissionError) return permissionError;

    if (data.passportIssueDate && data.passportExpiryDate && data.passportExpiryDate <= data.passportIssueDate) {
      return NextResponse.json(
        { success: false, error: "تاريخ انتهاء الجواز يجب أن يكون بعد تاريخ الإصدار" },
        { status: 400 },
      );
    }

    const employee = await prisma.$transaction(async (tx) => {
      const createdEmployee = await tx.employee.create({
        data: {
          companyId: data.companyId,
          branchId: data.branchId,
          licenseId: data.licenseId,
          clientGeneratedId: data.clientGeneratedId,
          positionId: data.positionId,
          employeeNumber: data.employeeNumber,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          type: data.type,
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
          licenseExpiry: data.licenseExpiry,
          jobTitle: data.jobTitle,
          residentialAddress: data.residentialAddress,
          employmentStatus: data.employmentStatus,
          phone: data.phone,
          joinDate: data.joinDate,
          endDate: data.endDate,
          baseSalary: data.baseSalary,
          bankAccountNumber: data.bankAccountNumber,
          passportCustodyStatus: data.passportCustodyStatus,
          passportReceivedDate: data.passportReceivedDate,
          passportReleasedDate: data.passportReleasedDate,
          passportReleaseNotes: data.passportReleaseNotes,
          notes: data.notes,
        },
      });

      // ربط التراخيص الإضافية (الإداريون العابرون للشركات)
      if (data.additionalLicenseIds && data.additionalLicenseIds.length > 0) {
        await tx.employeeLicenseAssignment.createMany({
          data: data.additionalLicenseIds
            .filter((lid) => lid !== data.licenseId) // لا نكرر الترخيص الأساسي
            .map((licenseId) => ({ employeeId: createdEmployee.id, licenseId })),
          skipDuplicates: true,
        });
      }

      if (data.type === "CAR_WASH_DRIVER" || data.type === "CAR_WASH_WORKER") {
        await tx.carWashWorker.create({
          data: {
            employeeId: createdEmployee.id,
            companyId: data.companyId,
            branchId: data.branchId,
            role: data.carWashWorkerRole ?? (data.type === "CAR_WASH_DRIVER" ? "CAR_WASH_DRIVER" : "WASHING_WORKER"),
            assignedCarWashVehicleId: data.assignedCarWashVehicleId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          companyId: data.companyId,
          branchId: data.branchId,
          action: "CREATE_EMPLOYEE",
          module: "hr",
          resourceId: createdEmployee.id,
          resourceType: "Employee",
          newValues: { type: data.type, employmentStatus: data.employmentStatus },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return createdEmployee;
    });

    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في إضافة الموظف" }, { status: 500 });
  }
}
