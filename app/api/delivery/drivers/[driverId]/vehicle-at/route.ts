import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Ctx { params: Promise<{ driverId: string }> }

// يرجّع السيارة التي كان السائق مخصّصاً لها في تاريخ/وقت محدد،
// اعتماداً على سجل تبديل السيارات (DriverVehicleAssignment).
// إن لم يوجد تخصيص يغطّي التاريخ، يرجع السيارة المخصّصة حالياً.
export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { driverId } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const at = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ success: false, error: "تاريخ غير صالح" }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        assignedVehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        employee: { select: { companyId: true } },
      },
    });
    if (!driver) return NextResponse.json({ success: false, error: "السائق غير موجود" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, driver.employee.companyId);
    if (companyAccessError) return companyAccessError;

    // التخصيص الذي يغطّي التاريخ المطلوب: بدأ قبله ولم ينتهِ بعده
    const assignment = await prisma.driverVehicleAssignment.findFirst({
      where: {
        driverId,
        assignedFrom: { lte: at },
        OR: [{ assignedTo: null }, { assignedTo: { gte: at } }],
      },
      orderBy: { assignedFrom: "desc" },
      include: { vehicle: { select: { id: true, plateNumber: true, make: true, model: true } } },
    });

    const vehicle = assignment?.vehicle ?? driver.assignedVehicle ?? null;

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تحديد سيارة السائق" }, { status: 500 });
  }
}
