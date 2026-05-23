import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ vehicleId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { companyId: true },
    });
    if (!vehicle) return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, vehicle.companyId);
    if (companyAccessError) return companyAccessError;

    const attachments = await prisma.attachment.findMany({
      where: { refModule: "VEHICLE", refId: vehicleId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: attachments });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب المرفقات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { companyId: true },
    });
    if (!vehicle) return NextResponse.json({ success: false, error: "المركبة غير موجودة" }, { status: 404 });

    const companyAccessError = assertCompanyAccess(session, vehicle.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "ATTACHMENTS", "UPLOAD", { companyId: vehicle.companyId });
    if (permissionError) return permissionError;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentCategory = formData.get("documentCategory") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file) return NextResponse.json({ success: false, error: "الملف مطلوب" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ success: false, error: "حجم الملف يتجاوز 20 ميجابايت" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const key = `vehicles/${vehicleId}/${uniqueName}`;
    const filePath = await uploadToR2(key, buffer, file.type || "application/octet-stream");

    const attachment = await prisma.attachment.create({
      data: {
        companyId: vehicle.companyId,
        entityType: "VEHICLE",
        entityId: vehicleId,
        fileName: uniqueName,
        originalName: file.name,
        fileType: ext,
        fileSize: file.size,
        filePath,
        refModule: "VEHICLE",
        refId: vehicleId,
        uploadedById: session.id,
        mimeType: file.type || "application/octet-stream",
        storagePath: key,
        documentCategory: documentCategory || undefined,
        notes: notes || undefined,
      },
    });

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في رفع الملف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { vehicleId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachmentId");
    if (!attachmentId) return NextResponse.json({ success: false, error: "معرف المرفق مطلوب" }, { status: 400 });

    const att = await prisma.attachment.findFirst({
      where: { id: attachmentId, refModule: "VEHICLE", refId: vehicleId, deletedAt: null },
    });
    if (!att) return NextResponse.json({ success: false, error: "المرفق غير موجود" }, { status: 404 });

    if (att.storagePath) await deleteFromR2(att.storagePath).catch(() => {});

    await prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف المرفق";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
