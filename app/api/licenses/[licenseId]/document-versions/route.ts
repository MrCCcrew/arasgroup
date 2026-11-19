import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ licenseId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { licenseId } = await params;
  const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
  if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
  const denied = assertCompanyAccess(session, license.companyId); if (denied) return denied;
  const data = await prisma.licenseDocumentVersion.findMany({ where: { licenseId }, orderBy: [{ sectionType: "asc" }, { version: "desc" }] });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ licenseId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { licenseId } = await params;
  const versionId = new URL(request.url).searchParams.get("versionId");
  if (!versionId) return NextResponse.json({ success: false, error: "Version ID is required" }, { status: 400 });

  try {
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!license) return NextResponse.json({ success: false, error: "License not found" }, { status: 404 });
    const denied = assertCompanyAccess(session, license.companyId); if (denied) return denied;
    const permissionDenied = assertPermission(session, "LICENSES", "DELETE", { companyId: license.companyId });
    if (permissionDenied) return permissionDenied;

    const version = await prisma.licenseDocumentVersion.findFirst({ where: { id: versionId, licenseId }, select: { id: true } });
    if (!version) return NextResponse.json({ success: false, error: "Document version not found" }, { status: 404 });
    await prisma.licenseDocumentVersion.delete({ where: { id: version.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to delete document version" }, { status: 500 });
  }
}
