import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertBranchAccess, assertCompanyAccess, assertPermission, isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";
import { CompletedTaskStatus } from "@prisma/client";
import { endOfDay, endOfMonth, endOfWeek, endOfYear, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";

const dateValue = z.string().min(1).transform((value) => new Date(value));

const taskSchema = z.object({
  userId: z.string().optional(),
  companyId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  titleAr: z.string().min(2, "عنوان المهمة بالعربية مطلوب"),
  titleEn: z.string().optional().nullable(),
  detailsAr: z.string().optional().nullable(),
  detailsEn: z.string().optional().nullable(),
  taskDate: dateValue,
  departedAt: z.string().optional().nullable(),
  returnedAt: z.string().optional().nullable(),
  status: z.nativeEnum(CompletedTaskStatus),
  deferredToDate: z.string().optional().nullable(),
  outcomeNotes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

function normalizeOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function resolvePeriodRange(period: string | null, dateValue: string | null) {
  if (!period || period === "all") return undefined;

  const basis = dateValue ? parseISO(dateValue) : new Date();
  if (Number.isNaN(basis.getTime())) return undefined;

  switch (period) {
    case "day":
      return { gte: startOfDay(basis), lte: endOfDay(basis) };
    case "week":
      return { gte: startOfWeek(basis, { weekStartsOn: 6 }), lte: endOfWeek(basis, { weekStartsOn: 6 }) };
    case "month":
      return { gte: startOfMonth(basis), lte: endOfMonth(basis) };
    case "year":
      return { gte: startOfYear(basis), lte: endOfYear(basis) };
    default:
      return undefined;
  }
}

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const permissionError = assertPermission(session, "TASKS", "VIEW");
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const period = searchParams.get("period");
  const periodDate = searchParams.get("date");
  const userId = searchParams.get("userId");

  const ownerOrAdmin = isOwnerOrAdminSession(session);
  const range = resolvePeriodRange(period, periodDate);

  const where = {
    userId: ownerOrAdmin && userId ? userId : ownerOrAdmin ? undefined : session.id,
    status: status && status !== "ALL" ? (status as CompletedTaskStatus) : undefined,
    taskDate: range,
  };

  const tasks = await prisma.completedTask.findMany({
    where,
    include: {
      user: { select: { id: true, nameAr: true, nameEn: true, email: true } },
      company: { select: { id: true, nameAr: true, nameEn: true } },
      branch: { select: { id: true, nameAr: true, nameEn: true } },
    },
    orderBy: [{ taskDate: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ success: true, data: tasks });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const permissionError = assertPermission(session, "TASKS", "CREATE");
  if (permissionError) return permissionError;

  try {
    const body = await request.json();
    const parsed = taskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "بيانات المهمة غير صالحة" }, { status: 400 });
    }

    const ownerOrAdmin = isOwnerOrAdminSession(session);
    const data = parsed.data;
    const targetUserId = ownerOrAdmin && data.userId ? data.userId : session.id;

    if (data.companyId) {
      const companyError = assertCompanyAccess(session, data.companyId);
      if (companyError && !ownerOrAdmin) return companyError;
    }

    if (data.branchId) {
      const branchError = assertBranchAccess(session, data.branchId);
      if (branchError && !ownerOrAdmin) return branchError;
    }

    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.completedTask.create({
        data: {
          userId: targetUserId,
          companyId: data.companyId || null,
          branchId: data.branchId || null,
          titleAr: data.titleAr,
          titleEn: data.titleEn || null,
          detailsAr: data.detailsAr || null,
          detailsEn: data.detailsEn || null,
          taskDate: data.taskDate,
          departedAt: normalizeOptionalDate(data.departedAt),
          returnedAt: normalizeOptionalDate(data.returnedAt),
          status: data.status,
          deferredToDate: normalizeOptionalDate(data.deferredToDate),
          outcomeNotes: data.outcomeNotes || null,
          location: data.location || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "CREATE_COMPLETED_TASK",
          module: "tasks",
          resourceId: task.id,
          resourceType: "CompletedTask",
          companyId: task.companyId,
          branchId: task.branchId,
          newValues: {
            targetUserId,
            status: task.status,
            taskDate: task.taskDate,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return task;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ المهمة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
