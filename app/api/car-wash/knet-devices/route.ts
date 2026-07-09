import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { z } from "zod";

const updateSchema = z.object({
  companyId: z.string(),
  updates: z.array(
    z.object({
      vehicleId: z.string(),
      deviceId: z.string().nullable(),
    })
  ),
});

export async function PATCH(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { companyId, updates } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    // Update each vehicle's knetDeviceId
    const updateOperations = updates.map(({ vehicleId, deviceId }) =>
      prisma.carWashVehicle.update({
        where: { id: vehicleId },
        data: { knetDeviceId: deviceId },
      })
    );

    await prisma.$transaction(updateOperations);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "UPDATE_KNET_DEVICE_IDS",
        module: "car_wash",
        resourceType: "CarWashVehicle",
        resourceId: companyId,
        newValues: {
          count: updates.length,
          updates,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true, data: { updated: updates.length } });
  } catch (error) {
    console.error("Update KNET device IDs error:", error);
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
