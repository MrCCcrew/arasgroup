import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { allowsCrossCompanyLicenses, getAllowedEmployeeTypes } from "@/lib/hr/company-employee-rules";

interface Ctx {
  params: Promise<{ employeeId: string }>;
}

const EMPLOYEE_TYPES = [
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
] as const;

const optionalString = z.string().optional().nullable();

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: optionalString,
  employeeNumber: optionalString,
  positionId: optionalString,
  branchId: optionalString,
  licenseId: optionalString,
  residencyLicenseId: optionalString,
  workPermitLicenseId: optionalString,
  additionalLicenseIds: z.array(z.string()).optional(),
  nationality: optionalString,
  civilId: optionalString,
  passportNumber: optionalString,
  residencyNumber: optionalString,
  residencyExpiry: optionalString,
  licenseNumber: optionalString,
  licenseExpiry: optionalString,
  phone: optionalString,
  joinDate: optionalString,
  baseSalary: z.number().finite().min(0).optional(),
  bankAccountNumber: optionalString,
  notes: optionalString,
  isActive: z.boolean().optional(),
  type: z.enum(EMPLOYEE_TYPES).optional(),
  investorId: optionalString,
});

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: string | null | undefined, invalidMessage: string): { value: Date | null | undefined; error?: string } {
  if (value === undefined) return { value: undefined };
  if (value === null) return { value: null };

  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { value: undefined, error: invalidMessage };
  }

  return { value: parsed };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, isDeleted: false },
      include: {
        branch: { select: { nameAr: true } },
        license: { select: { id: true, commercialNameAr: true, licenseNumber: true, unifiedEntityNumber: true } },
        residencyLicense: { select: { id: true, commercialNameAr: true, licenseNumber: true, unifiedEntityNumber: true } },
        workPermitLicense: { select: { id: true, commercialNameAr: true, licenseNumber: true, unifiedEntityNumber: true } },
        licenseAssignments: {
          select: {
            licenseId: true,
            license: { select: { id: true, commercialNameAr: true, licenseNumber: true, unifiedEntityNumber: true } },
          },
        },
        driver: { select: { id: true, talabatId: true, roPopsId: true, isRegisteredTalabat: true, isRegisteredRoPops: true } },
        carWashWorker: { select: { id: true, role: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب الموظف" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  let employeeId = "";
  let companyId = "";

  try {
    ({ employeeId } = await params);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, branchId: true, type: true, isDeleted: true },
    });
    if (!existingEmployee || existingEmployee.isDeleted) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }
    companyId = existingEmployee.companyId;

    const companyAccessError = assertCompanyAccess(session, existingEmployee.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "HR", "UPDATE", {
      companyId: existingEmployee.companyId,
      branchId: normalizeOptionalString(parsed.data.branchId) ?? existingEmployee.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    const company = await prisma.company.findUnique({
      where: { id: existingEmployee.companyId },
      select: { id: true, type: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "الشركة غير موجودة" }, { status: 404 });
    }

    const nextType = parsed.data.type ?? existingEmployee.type;
    const allowedTypes = getAllowedEmployeeTypes(company.type);
    if (!allowedTypes.includes(nextType)) {
      return NextResponse.json({ success: false, error: "نوع الموظف غير مسموح لهذه الشركة" }, { status: 400 });
    }

    // Check if type is being changed
    if (parsed.data.type && parsed.data.type !== existingEmployee.type) {
      // Block type changes in DELIVERY and CAR_WASH companies (they have complex accounting)
      if (company.type === "DELIVERY" || company.type === "CAR_WASH") {
        return NextResponse.json(
          { success: false, error: "لا يمكن تغيير نوع الموظف في شركات التوصيل والغسيل" },
          { status: 400 }
        );
      }

      // For other companies, check if employee has financial records
      const [salaryPaymentsCount, endOfServiceCount, leavePayCount, ticketsCount] = await Promise.all([
        // Check salary payments
        prisma.salaryPayment.count({
          where: { employeeId },
        }),
        // Check end of service calculations
        prisma.endOfServiceCalc.count({
          where: { employeeId },
        }),
        // Check leave pay calculations
        prisma.leavePayCalc.count({
          where: { employeeId },
        }),
        // Check tickets
        prisma.employeeTicket.count({
          where: { employeeId },
        }),
      ]);

      const totalFinancialRecords = salaryPaymentsCount + endOfServiceCount + leavePayCount + ticketsCount;

      if (totalFinancialRecords > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `لا يمكن تغيير نوع الموظف لوجود ${totalFinancialRecords} سجل مالي مرتبط به (رواتب، نهاية خدمة، تذاكر)`,
          },
          { status: 400 }
        );
      }
    }

    if (!allowsCrossCompanyLicenses(company.type) && parsed.data.additionalLicenseIds?.length) {
      return NextResponse.json(
        { success: false, error: "لا يمكن ربط موظفي شركة الغسيل بتراخيص شركات أخرى" },
        { status: 400 },
      );
    }

    const normalizedNameAr = parsed.data.nameAr?.trim();
    if (normalizedNameAr !== undefined && normalizedNameAr.length < 2) {
      return NextResponse.json({ success: false, error: "الاسم العربي مطلوب" }, { status: 400 });
    }

    const branchId = normalizeOptionalString(parsed.data.branchId);
    const licenseId = normalizeOptionalString(parsed.data.licenseId);
    const residencyLicenseId = normalizeOptionalString(parsed.data.residencyLicenseId);
    const workPermitLicenseId = normalizeOptionalString(parsed.data.workPermitLicenseId);
    const investorId = normalizeOptionalString(parsed.data.investorId);
    const additionalLicenseIds = parsed.data.additionalLicenseIds
      ? [...new Set(parsed.data.additionalLicenseIds.map((licenseValue) => licenseValue.trim()).filter(Boolean))]
      : undefined;

    const joinDate = parseOptionalDate(parsed.data.joinDate, "تاريخ الالتحاق غير صالح");
    if (joinDate.error) {
      return NextResponse.json({ success: false, error: joinDate.error }, { status: 400 });
    }

    const residencyExpiry = parseOptionalDate(parsed.data.residencyExpiry, "تاريخ انتهاء الإقامة غير صالح");
    if (residencyExpiry.error) {
      return NextResponse.json({ success: false, error: residencyExpiry.error }, { status: 400 });
    }

    const licenseExpiry = parseOptionalDate(parsed.data.licenseExpiry, "تاريخ انتهاء الرخصة غير صالح");
    if (licenseExpiry.error) {
      return NextResponse.json({ success: false, error: licenseExpiry.error }, { status: 400 });
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId: existingEmployee.companyId },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json({ success: false, error: "الفرع المحدد غير صالح" }, { status: 400 });
      }
    }

    if (licenseId) {
      const license = await prisma.license.findFirst({
        where: { id: licenseId, companyId: existingEmployee.companyId },
        select: { id: true },
      });
      if (!license) {
        return NextResponse.json({ success: false, error: "الترخيص المحدد غير صالح" }, { status: 400 });
      }
    }

    for (const [selectedLicenseId, errorMessage] of [
      [residencyLicenseId, "رخصة الإقامة المحددة غير صالحة"],
      [workPermitLicenseId, "رخصة العمل المحددة غير صالحة"],
    ] as const) {
      if (!selectedLicenseId) continue;

      const selectedLicense = await prisma.license.findFirst({
        where: allowsCrossCompanyLicenses(company.type)
          ? { id: selectedLicenseId }
          : { id: selectedLicenseId, companyId: existingEmployee.companyId },
        select: { id: true },
      });

      if (!selectedLicense) {
        return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
      }
    }

    if (investorId) {
      const investor = await prisma.investor.findFirst({
        where: { id: investorId, companies: { some: { id: existingEmployee.companyId } } },
        select: { id: true },
      });
      if (!investor) {
        return NextResponse.json({ success: false, error: "المسؤول المحدد غير صالح" }, { status: 400 });
      }
    }

    if (additionalLicenseIds && additionalLicenseIds.length > 0) {
      const additionalLicenses = await prisma.license.findMany({
        where: allowsCrossCompanyLicenses(company.type)
          ? { id: { in: additionalLicenseIds } }
          : { id: { in: additionalLicenseIds }, companyId: existingEmployee.companyId },
        select: { id: true },
      });

      if (additionalLicenses.length !== additionalLicenseIds.length) {
        return NextResponse.json({ success: false, error: "أحد التراخيص الإضافية غير صالح" }, { status: 400 });
      }
    }

    const positionId = normalizeOptionalString(parsed.data.positionId);

    const updateData: Prisma.EmployeeUpdateInput = {
      ...(normalizedNameAr !== undefined ? { nameAr: normalizedNameAr } : {}),
      ...(parsed.data.nameEn !== undefined ? { nameEn: normalizeOptionalString(parsed.data.nameEn) } : {}),
      ...(parsed.data.employeeNumber !== undefined ? { employeeNumber: normalizeOptionalString(parsed.data.employeeNumber) } : {}),
      ...(parsed.data.positionId !== undefined ? { positionId } : {}),
      ...(parsed.data.nationality !== undefined ? { nationality: normalizeOptionalString(parsed.data.nationality) } : {}),
      ...(parsed.data.civilId !== undefined ? { civilId: normalizeOptionalString(parsed.data.civilId) } : {}),
      ...(parsed.data.passportNumber !== undefined ? { passportNumber: normalizeOptionalString(parsed.data.passportNumber) } : {}),
      ...(parsed.data.residencyNumber !== undefined ? { residencyNumber: normalizeOptionalString(parsed.data.residencyNumber) } : {}),
      ...(parsed.data.licenseNumber !== undefined ? { licenseNumber: normalizeOptionalString(parsed.data.licenseNumber) } : {}),
      ...(parsed.data.phone !== undefined ? { phone: normalizeOptionalString(parsed.data.phone) } : {}),
      ...(parsed.data.bankAccountNumber !== undefined ? { bankAccountNumber: normalizeOptionalString(parsed.data.bankAccountNumber) } : {}),
      ...(parsed.data.notes !== undefined ? { notes: normalizeOptionalString(parsed.data.notes) } : {}),
      ...(parsed.data.baseSalary !== undefined ? { baseSalary: parsed.data.baseSalary } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.branchId !== undefined ? { branchId } : {}),
      ...(parsed.data.licenseId !== undefined ? { licenseId } : {}),
      ...(parsed.data.residencyLicenseId !== undefined ? { residencyLicenseId } : {}),
      ...(parsed.data.workPermitLicenseId !== undefined ? { workPermitLicenseId } : {}),
      ...(parsed.data.investorId !== undefined ? { investorId } : {}),
      ...(parsed.data.joinDate !== undefined ? { joinDate: joinDate.value } : {}),
      ...(parsed.data.residencyExpiry !== undefined ? { residencyExpiry: residencyExpiry.value } : {}),
      ...(parsed.data.licenseExpiry !== undefined ? { licenseExpiry: licenseExpiry.value } : {}),
    };

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      if (additionalLicenseIds !== undefined) {
        await tx.employeeLicenseAssignment.deleteMany({ where: { employeeId } });
        if (additionalLicenseIds.length > 0) {
          await tx.employeeLicenseAssignment.createMany({
            data: additionalLicenseIds
              .filter((licenseId) => licenseId !== updated.licenseId)
              .map((licenseId) => ({ employeeId, licenseId })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error("UPDATE_EMPLOYEE_ERROR", {
      employeeId,
      companyId,
      error,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ success: false, error: "توجد بيانات مكررة لموظف آخر" }, { status: 400 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ success: false, error: "تعذر حفظ التعديل بسبب ارتباط غير صالح" }, { status: 400 });
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ success: false, error: "بيانات التعديل غير صالحة" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, branchId: true, isDeleted: true },
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }
    if (employee.isDeleted) {
      return NextResponse.json({ success: false, error: "تم حذف الموظف بالفعل" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, employee.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "HR", "DELETE", {
      companyId: employee.companyId,
      branchId: employee.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isDeleted: true, deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
