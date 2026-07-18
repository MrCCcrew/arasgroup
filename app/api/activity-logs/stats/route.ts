import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId مطلوب" },
        { status: 400 }
      );
    }

    const where: any = { userId };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    // Get all logs for the period
    const logs = await prisma.employeeActivityLog.findMany({
      where,
      select: {
        activityType: true,
        applicationName: true,
        url: true,
        durationSeconds: true,
        isIdle: true,
        startTime: true,
        endTime: true,
      },
    });

    // Calculate stats
    const totalLogs = logs.length;
    const totalActiveSeconds = logs
      .filter((log) => !log.isIdle && log.durationSeconds)
      .reduce((sum, log) => sum + (log.durationSeconds || 0), 0);
    const totalIdleSeconds = logs
      .filter((log) => log.isIdle && log.durationSeconds)
      .reduce((sum, log) => sum + (log.durationSeconds || 0), 0);

    // Top applications
    const appUsage: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.applicationName && log.durationSeconds && !log.isIdle) {
        appUsage[log.applicationName] = (appUsage[log.applicationName] || 0) + log.durationSeconds;
      }
    });
    const topApplications = Object.entries(appUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, seconds]) => ({ name, seconds }));

    // Top websites
    const websiteUsage: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.url && log.durationSeconds && !log.isIdle) {
        try {
          const hostname = new URL(log.url).hostname;
          websiteUsage[hostname] = (websiteUsage[hostname] || 0) + log.durationSeconds;
        } catch {
          // Invalid URL, skip
        }
      }
    });
    const topWebsites = Object.entries(websiteUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, seconds]) => ({ name, seconds }));

    // Activity by type
    const activityByType: Record<string, number> = {};
    logs.forEach((log) => {
      const type = log.activityType;
      activityByType[type] = (activityByType[type] || 0) + 1;
    });

    // Activity by hour (for productivity chart)
    const activityByHour: Record<number, number> = {};
    logs.forEach((log) => {
      if (log.durationSeconds && !log.isIdle) {
        const hour = new Date(log.startTime).getHours();
        activityByHour[hour] = (activityByHour[hour] || 0) + log.durationSeconds;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalLogs,
        totalActiveSeconds,
        totalIdleSeconds,
        totalActiveTime: formatDuration(totalActiveSeconds),
        totalIdleTime: formatDuration(totalIdleSeconds),
        productivityPercentage:
          totalActiveSeconds + totalIdleSeconds > 0
            ? Math.round((totalActiveSeconds / (totalActiveSeconds + totalIdleSeconds)) * 100)
            : 0,
        topApplications,
        topWebsites,
        activityByType,
        activityByHour: Object.entries(activityByHour)
          .map(([hour, seconds]) => ({ hour: parseInt(hour), seconds }))
          .sort((a, b) => a.hour - b.hour),
      },
    });
  } catch (error) {
    console.error("Activity stats error:", error);
    return NextResponse.json(
      { success: false, error: "فشل في حساب الإحصائيات" },
      { status: 500 }
    );
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  } else if (minutes > 0) {
    return `${minutes}د ${secs}ث`;
  } else {
    return `${secs}ث`;
  }
}
