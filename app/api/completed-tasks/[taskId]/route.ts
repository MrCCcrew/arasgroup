import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CompletedTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertBranchAccess,
  assertCompanyAccess,
  assertPermission,
  isOwnerOrAdminSession,
  requireRequestSession,
} from "@/lib/auth/access";

const taskUpdateSchema = z.object({
  companyId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  titleAr: z.string().min(2, "عنوان المهمة بالعربية مطلوب"),
  titleEn: z.string().optional().nullable(),
  detailsAr: z.string().optional().nullable(),
  detailsEn: z.string().optional().nullable(),
  taskDate: z.string().min(1),
  departedAt: z.string().optional().nullable(),
  returnedAt: z.string().optional().nullable(),
  status: z.nativeEnum(CompletedTaskStatus),
  deferredToDate: z.string().optional().nullable(),
  outcomeNotes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

function asOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const permissionError = assertPermission(session, "TASKS", "UPDATE");
  if (permissionError) return permissionError;

  const { taskId } = await params;
  const existing = await prisma.completedTask.findUnique({ where: { id: taskId } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });
  }

  const ownerOrAdmin = isOwnerOrAdminSession(session);
  if (!ownerOrAdmin && existing.userId !== session.id) {
    return NextResponse.json({ success: false, error: "غير مصرح بتعديل هذه المهمة" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "بيانات المهمة غير صالحة" },
        { status: 400 },
      );
    }

    if (parsed.data.companyId) {
      const companyError = assertCompanyAccess(session, parsed.data.companyId);
      if (companyError && !ownerOrAdmin) return companyError;
    }

    if (parsed.data.branchId) {
      const branchError = assertBranchAccess(session, parsed.data.branchId);
      if (branchError && !ownerOrAdmin) return branchError;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.completedTask.update({
        where: { id: taskId },
        data: {
          companyId: parsed.data.companyId || null,
          branchId: parsed.data.branchId || null,
          titleAr: parsed.data.titleAr,
          titleEn: parsed.data.titleEn || null,
          detailsAr: parsed.data.detailsAr || null,
          detailsEn: parsed.data.detailsEn || null,
          taskDate: new Date(parsed.data.taskDate),
          departedAt: asOptionalDate(parsed.data.departedAt),
          returnedAt: asOptionalDate(parsed.data.returnedAt),
          status: parsed.data.status,
          deferredToDate: asOptionalDate(parsed.data.deferredToDate),
          outcomeNotes: parsed.data.outcomeNotes || null,
          location: parsed.data.location || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "UPDATE_COMPLETED_TASK",
          module: "tasks",
          resourceId: task.id,
          resourceType: "CompletedTask",
          companyId: task.companyId,
          branchId: task.branchId,
          oldValues: {
            status: existing.status,
            taskDate: existing.taskDate,
          },
          newValues: {
            status: task.status,
            taskDate: task.taskDate,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return task;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث المهمة";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const permissionError = assertPermission(session, "TASKS", "DELETE");
  if (permissionError && !isOwnerOrAdminSession(session)) return permissionError;

  const { taskId } = await params;
  const existing = await prisma.completedTask.findUnique({ where: { id: taskId } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "المهمة غير موجودة" }, { status: 404 });
  }

  const ownerOrAdmin = isOwnerOrAdminSession(session);
  if (!ownerOrAdmin && existing.userId !== session.id) {
    return NextResponse.json({ success: false, error: "غير مصرح بحذف هذه المهمة" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.completedTask.delete({ where: { id: taskId } });
    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: "DELETE_COMPLETED_TASK",
        module: "tasks",
        resourceId: taskId,
        resourceType: "CompletedTask",
        companyId: existing.companyId,
        branchId: existing.branchId,
        oldValues: {
          titleAr: existing.titleAr,
          status: existing.status,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });
  });

  return NextResponse.json({ success: true });
}
