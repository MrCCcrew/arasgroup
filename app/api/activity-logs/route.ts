import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { uploadToR2 } from "@/lib/storage/r2";

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

const screenshotSchema = z.object({
  timestamp: z.string(),
  image: z.string(), // base64
});

const batchLogsSchema = z.object({
  logs: z.array(activityLogSchema),
  screenshot: screenshotSchema.optional(),
});

// POST - Desktop App sends activity logs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single log and batch logs
    const isBatch = Array.isArray(body.logs);

    let logsToCreate: z.infer<typeof activityLogSchema>[];
    let screenshot: z.infer<typeof screenshotSchema> | null = null;

    if (isBatch) {
      const parsed = batchLogsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "بيانات غير صالحة", details: parsed.error.errors },
          { status: 400 }
        );
      }
      logsToCreate = parsed.data.logs;
      screenshot = parsed.data.screenshot || null;
    } else {
      const parsed = activityLogSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "بيانات غير صالحة", details: parsed.error.errors },
          { status: 400 }
        );
      }
      logsToCreate = [parsed.data];
    }

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

    // Upload screenshot to R2 if provided
    let screenshotUrl: string | null = null;
    if (screenshot) {
      try {
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(screenshot.image, "base64");
        const fileName = `screenshots/${firstLog.userId}/${Date.now()}.jpg`;

        // Upload to R2
        screenshotUrl = await uploadToR2(fileName, imageBuffer, "image/jpeg");

        console.log("Screenshot uploaded:", screenshotUrl);
      } catch (error) {
        console.error("Failed to upload screenshot:", error);
        // Continue without screenshot if upload fails
      }
    }

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
        screenshotUrl: screenshotUrl, // Add screenshot URL to all logs in this batch
      })),
    });

    return NextResponse.json({
      success: true,
      message: `تم حفظ ${created.count} سجل نشاط`,
      count: created.count,
      screenshotUploaded: !!screenshotUrl,
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

// DELETE - Delete activity logs (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const logIds = searchParams.get("ids")?.split(",") || [];

    if (logIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "لم يتم تحديد سجلات للحذف" },
        { status: 400 }
      );
    }

    // Fetch logs to get screenshot URLs before deletion
    const logs = await prisma.employeeActivityLog.findMany({
      where: { id: { in: logIds } },
      select: { id: true, screenshotUrl: true },
    });

    // Delete screenshots from R2
    const { deleteFromR2 } = await import("@/lib/storage/r2");
    const deletePromises = logs
      .filter((log) => log.screenshotUrl)
      .map(async (log) => {
        try {
          // Extract key from URL (format: https://pub-xxx.r2.dev/screenshots/userId/timestamp.jpg)
          const url = new URL(log.screenshotUrl!);
          const key = url.pathname.substring(1); // Remove leading slash
          await deleteFromR2(key);
          console.log(`Deleted screenshot: ${key}`);
        } catch (error) {
          console.error(`Failed to delete screenshot for log ${log.id}:`, error);
        }
      });

    await Promise.all(deletePromises);

    // Delete logs from database
    const deleted = await prisma.employeeActivityLog.deleteMany({
      where: { id: { in: logIds } },
    });

    return NextResponse.json({
      success: true,
      message: `تم حذف ${deleted.count} سجل`,
      count: deleted.count,
    });
  } catch (error) {
    console.error("Delete activity logs error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في حذف السجلات" },
      { status: 500 }
    );
  }
}
