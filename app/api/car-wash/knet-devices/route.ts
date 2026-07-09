import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const formData = await request.formData();
    const companyId = formData.get("companyId") as string;

    if (!companyId) {
      return NextResponse.json({ success: false, error: "Company ID is required" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // Get all vehicle IDs from form
    const vehicleIds: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.endsWith("_id")) {
        vehicleIds.push(value as string);
      }
    }

    // Update each vehicle's knetDeviceId
    const updates = vehicleIds.map((vehicleId) => {
      const deviceId = formData.get(`${vehicleId}_deviceId`) as string;
      return prisma.carWashVehicle.update({
        where: { id: vehicleId },
        data: { knetDeviceId: deviceId || null },
      });
    });

    await prisma.$transaction(updates);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "UPDATE_KNET_DEVICE_IDS",
        module: "car_wash",
        resourceType: "CarWashVehicle",
        resourceId: companyId,
        newValues: {
          count: vehicleIds.length,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.redirect(new URL(`/dashboard/companies/${companyId}/car-wash/knet`, request.url));
  } catch (error) {
    console.error("Update KNET device IDs error:", error);
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
