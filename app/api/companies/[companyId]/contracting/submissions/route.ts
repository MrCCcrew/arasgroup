import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage/r2";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};
const MAX_SIZE = 10 * 1024 * 1024;

async function access(request: NextRequest, companyId: string, action: "VIEW" | "CREATE") {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId);
  if (companyError) return companyError;
  const permissionError = assertPermission(session, "CONTRACTING_SUBMISSIONS", action, { companyId });
  if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "CONTRACTING", isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "هذه الخدمة متاحة لشركات المقاولات فقط" }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const session = await access(request, companyId, "VIEW");
  if (session instanceof NextResponse) return session;
  const [projects, submissions] = await Promise.all([
    prisma.constructionProject.findMany({ where: { companyId, status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.attachment.findMany({
      where: { companyId, entityType: "CONSTRUCTION_PROJECT", attachmentType: { in: ["CONTRACTING_INVOICE", "CONTRACTING_DEPOSIT_RECEIPT"] }, deletedAt: null },
      include: { uploadedBy: { select: { nameAr: true } } }, orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);
  const projectNames = new Map(projects.map(project => [project.id, `${project.code} — ${project.name}`]));
  return NextResponse.json({ success: true, data: { projects, submissions: submissions.map(row => ({ ...row, projectName: projectNames.get(row.entityId ?? "") ?? "مشروع غير نشط أو مؤرشف", mine: row.uploadedById === session.id })) } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const session = await access(request, companyId, "CREATE");
  if (session instanceof NextResponse) return session;
  const attachmentPermission = assertPermission(session, "ATTACHMENTS", "UPLOAD", { companyId });
  if (attachmentPermission) return attachmentPermission;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "");
    const kind = String(form.get("kind") ?? "");
    const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);
    if (!(file instanceof File) || !projectId || !["INVOICE", "DEPOSIT_RECEIPT"].includes(kind)) return NextResponse.json({ success: false, error: "اختر المشروع ونوع المستند والملف" }, { status: 400 });
    if (file.size > MAX_SIZE || !allowedTypes[file.type]) return NextResponse.json({ success: false, error: "ارفع PDF أو صورة بحجم لا يتجاوز 10 ميجابايت" }, { status: 400 });
    const project = await prisma.constructionProject.findFirst({ where: { id: projectId, companyId, status: "ACTIVE" }, select: { id: true, code: true, name: true } });
    if (!project) return NextResponse.json({ success: false, error: "المشروع المختار غير صالح أو غير نشط" }, { status: 400 });
    const extension = allowedTypes[file.type];
    const storagePath = `construction-project/${project.id}/${kind.toLowerCase()}-${nanoid(12)}.${extension}`;
    const filePath = await uploadToR2(storagePath, Buffer.from(await file.arrayBuffer()), file.type);
    const attachment = await prisma.attachment.create({ data: {
      companyId, entityType: "CONSTRUCTION_PROJECT", entityId: project.id, attachmentType: kind === "INVOICE" ? "CONTRACTING_INVOICE" : "CONTRACTING_DEPOSIT_RECEIPT",
      fileName: storagePath, originalName: file.name, fileType: file.type, mimeType: file.type, fileSize: file.size, filePath, storagePath,
      refModule: "CONTRACTING", refId: project.id, notes: notes || null, uploadedById: session.id,
    } });
    await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "UPLOAD_CONTRACTING_SUBMISSION", module: "contracting", resourceId: attachment.id, resourceType: "ConstructionProject", newValues: { projectId: project.id, projectCode: project.code, kind, fileName: file.name } } });
    return NextResponse.json({ success: true, data: { ...attachment, projectName: `${project.code} — ${project.name}` } }, { status: 201 });
  } catch (error) {
    console.error("Contracting submission upload:", error);
    return NextResponse.json({ success: false, error: "تعذر رفع المستند" }, { status: 500 });
  }
}
