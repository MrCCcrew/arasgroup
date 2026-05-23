import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ driverId: string }> }

const updateSchema = z.object({
  // بيانات الموظف
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
  // بيانات السائق
  talabatId: z.string().optional().nullable(),
  roPopsId: z.string().optional().nullable(),
  isRegisteredTalabat: z.boolean().optional(),
  isRegisteredRoPops: z.boolean().optional(),
  fuelCardNumber: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(_request);
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
            baseSalary: true,
            residencyNumber: true,
            residencyExpiry: true,
            healthCardExpiryDate: true,
            licenseNumber: true,
            licenseExpiry: true,
            residentialAddress: true,
          },
        },
      },
    });
    if (!driver) return NextResponse.json({ success: false, error: "السائق غير موجود" }, { status: 404 });
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
    if (!parsed.success)
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const {
      talabatId, roPopsId, isRegisteredTalabat, isRegisteredRoPops, fuelCardNumber,
      nameAr, nameEn, phone, nationality, civilId, passportNumber, passportExpiryDate,
      baseSalary, residencyNumber, residencyExpiry, healthCardExpiryDate,
      licenseNumber, licenseExpiry, residentialAddress,
    } = parsed.data;

    const driver = await prisma.$transaction(async (tx) => {
      // تحديث بيانات الموظف
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

      const drv = await tx.driver.findUnique({ where: { id: driverId }, select: { employeeId: true } });
      if (!drv) throw new Error("السائق غير موجود");

      if (Object.keys(employeeData).length > 0) {
        await tx.employee.update({ where: { id: drv.employeeId }, data: employeeData });
      }

      // تحديث بيانات السائق
      const driverData: Record<string, unknown> = {};
      if (talabatId !== undefined) driverData.talabatId = talabatId;
      if (roPopsId !== undefined) driverData.roPopsId = roPopsId;
      if (isRegisteredTalabat !== undefined) driverData.isRegisteredTalabat = isRegisteredTalabat;
      if (isRegisteredRoPops !== undefined) driverData.isRegisteredRoPops = isRegisteredRoPops;
      if (fuelCardNumber !== undefined) driverData.fuelCardNumber = fuelCardNumber;

      return tx.driver.update({
        where: { id: driverId },
        data: driverData,
        include: { employee: { select: { nameAr: true, nameEn: true, residencyExpiry: true } } },
      });
    });

    return NextResponse.json({ success: true, data: driver });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}
