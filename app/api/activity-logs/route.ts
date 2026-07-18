import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Schema for activity log from desktop app
const activityLogSchema = z.object({
  userId: z.string().min(1),
  activityType: z.enum(["WINDOW_CHANGE", "WEBSITE_VISIT", "APPLICATION_USE", "IDLE", "ACTIVE"]),
  windowTitle: z.string().optional().nullable(),
  applicationName: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  startTime: z.string(), // ISO date string
  endTime: z.string().optional().nullable(), // ISO date string
  durationSeconds: z.number().optional().nullable(),
  isIdle: z.boolean().default(false),
  deviceName: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  authToken: z.string().min(1), // Desktop app authentication token
});

const batchLogsSchema = z.object({
  logs: z.array(activityLogSchema),
});

// POST - Desktop App sends activity logs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single log and batch logs
    const isBatch = Array.isArray(body.logs);
    const parsed = isBatch ? batchLogsSchema.safeParse(body) : activityLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "بيانات غير صالحة", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const logsToCreate = isBatch ? parsed.data.logs : [parsed.data];

    // Verify auth token for the first log (all should have same user)
    const firstLog = logsToCreate[0];
    const user = await prisma.user.findUnique({
      where: { id: firstLog.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "مستخدم غير موجود أو غير نشط" },
        { status: 401 }
      );
    }

    // TODO: Verify authToken matches user's desktop app token
    // For now, we'll accept any valid userId

    // Create activity logs
    const created = await prisma.employeeActivityLog.createMany({
      data: logsToCreate.map((log) => ({
        userId: log.userId,
        activityType: log.activityType,
        windowTitle: log.windowTitle || null,
        applicationName: log.applicationName || null,
        url: log.url || null,
        startTime: new Date(log.startTime),
        endTime: log.endTime ? new Date(log.endTime) : null,
        durationSeconds: log.durationSeconds || null,
        isIdle: log.isIdle,
        deviceName: log.deviceName || null,
        ipAddress: log.ipAddress || null,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `تم حفظ ${created.count} سجل نشاط`,
      count: created.count,
    });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في حفظ سجل النشاط" },
      { status: 500 }
    );
  }
}

// GET - Fetch activity logs for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const activityType = searchParams.get("activityType");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = {};

    if (userId) where.userId = userId;
    if (activityType) where.activityType = activityType;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    const logs = await prisma.employeeActivityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: logs.map((log) => ({
        ...log,
        startTime: log.startTime.toISOString(),
        endTime: log.endTime?.toISOString() || null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في جلب سجلات النشاط" },
      { status: 500 }
    );
  }
}
