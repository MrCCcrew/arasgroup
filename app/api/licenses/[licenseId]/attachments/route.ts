import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";

interface Props {
  params: Promise<{ licenseId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { licenseId } = await params;
    const attachments = await prisma.attachment.findMany({
      where: { refModule: "LICENSE", refId: licenseId, deletedAt: null },
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
    const { licenseId } = await params;

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      select: { companyId: true },
    });
    if (!license) {
      return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const notes = formData.get("notes") as string | null;
    const documentCategory = formData.get("documentCategory") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "الملف مطلوب" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "حجم الملف يتجاوز 20 ميجابايت" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const key = `licenses/${licenseId}/${uniqueName}`;

    const filePath = await uploadToR2(key, buffer, file.type || "application/octet-stream");

    const attachment = await prisma.attachment.create({
      data: {
        companyId: license.companyId,
        fileName: uniqueName,
        originalName: file.name,
        fileType: ext,
        fileSize: file.size,
        filePath,
        refModule: "LICENSE",
        refId: licenseId,
        uploadedById: session.id,
        mimeType: file.type || "application/octet-stream",
        storagePath: key,
        notes: notes || undefined,
        documentCategory: documentCategory || undefined,
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
    const { licenseId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json({ success: false, error: "معرف المرفق مطلوب" }, { status: 400 });
    }

    const att = await prisma.attachment.findFirst({
      where: { id: attachmentId, refModule: "LICENSE", refId: licenseId, deletedAt: null },
    });
    if (!att) {
      return NextResponse.json({ success: false, error: "المرفق غير موجود" }, { status: 404 });
    }

    if (att.storagePath) {
      await deleteFromR2(att.storagePath).catch(() => {});
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف المرفق";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
