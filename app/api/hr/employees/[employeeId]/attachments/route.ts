import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFromR2 } from "@/lib/storage/r2";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ employeeId: string }>;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, branchId: true },
  });
  if (!employee) {
    return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
  }

  const permissionError = assertPermission(session, "ATTACHMENTS", "VIEW", {
    companyId: employee.companyId,
    branchId: employee.branchId ?? undefined,
  });
  if (permissionError) return permissionError;

  const attachments = await prisma.attachment.findMany({
    where: {
      companyId: employee.companyId,
      entityType: "EMPLOYEE",
      entityId: employeeId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: attachments });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { employeeId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("id");
    if (!attachmentId) {
      return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        entityType: "EMPLOYEE",
        entityId: employeeId,
        deletedAt: null,
      },
    });
    if (!attachment) {
      return NextResponse.json({ success: false, error: "المرفق غير موجود" }, { status: 404 });
    }

    const permissionError = assertPermission(session, "ATTACHMENTS", "DELETE", {
      companyId: attachment.companyId ?? undefined,
      branchId: attachment.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    if (attachment.storagePath) {
      await deleteFromR2(attachment.storagePath);
    } else {
      await deleteFromR2(attachment.fileName);
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId: attachment.companyId,
        branchId: attachment.branchId,
        action: "DELETE_ATTACHMENT",
        module: "attachments",
        resourceId: attachment.id,
        resourceType: attachment.entityType ?? "Attachment",
        oldValues: { fileName: attachment.originalName, attachmentType: attachment.attachmentType },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في حذف المرفق" }, { status: 500 });
  }
}
