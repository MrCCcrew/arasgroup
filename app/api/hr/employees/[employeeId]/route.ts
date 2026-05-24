import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";
import { allowsCrossCompanyLicenses, getAllowedEmployeeTypes } from "@/lib/hr/company-employee-rules";

interface Ctx { params: Promise<{ employeeId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, isDeleted: false },
      include: {
        branch: { select: { nameAr: true } },
        license: { select: { id: true, commercialNameAr: true, licenseNumber: true, unifiedEntityNumber: true } },
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
    if (!employee) return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب الموظف" }, { status: 500 });
  }
}

const EMPLOYEE_TYPES = [
  "DRIVER", "DELIVERY_DRIVER", "DELIVERY_ADMIN", "CAR_WASH_DRIVER",
  "CAR_WASH_WORKER", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB",
  "OFFICE_BOY", "OTHER",
] as const;

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  employeeNumber: z.string().optional(),
  branchId: z.string().optional().nullable(),
  licenseId: z.string().optional().nullable(),
  additionalLicenseIds: z.array(z.string()).optional(),
  nationality: z.string().optional(),
  civilId: z.string().optional(),
  passportNumber: z.string().optional(),
  residencyNumber: z.string().optional(),
  residencyExpiry: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  phone: z.string().optional(),
  joinDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  baseSalary: z.number().optional(),
  bankAccountNumber: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  type: z.enum(EMPLOYEE_TYPES).optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { employeeId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, type: true },
    });
    if (!existingEmployee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }

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

    if (!allowsCrossCompanyLicenses(company.type) && parsed.data.additionalLicenseIds?.length) {
      return NextResponse.json(
        { success: false, error: "لا يمكن ربط موظفي شركة الغسيل بتراخيص شركات أخرى" },
        { status: 400 }
      );
    }

    const { additionalLicenseIds, ...updateData } = parsed.data;

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      // تحديث التراخيص الإضافية: احذف القديمة وأضف الجديدة
      if (additionalLicenseIds !== undefined) {
        await tx.employeeLicenseAssignment.deleteMany({ where: { employeeId } });
        if (additionalLicenseIds.length > 0) {
          await tx.employeeLicenseAssignment.createMany({
            data: additionalLicenseIds
              .filter((lid) => lid !== updated.licenseId)
              .map((licenseId) => ({ employeeId, licenseId })),
            skipDuplicates: true,
          });
        }
      }
      return updated;
    });
    return NextResponse.json({ success: true, data: employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { employeeId } = await params;
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
