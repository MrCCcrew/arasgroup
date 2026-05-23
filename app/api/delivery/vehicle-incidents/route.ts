import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const driverId  = searchParams.get("driverId");
  const vehicleId = searchParams.get("vehicleId");
  const status    = searchParams.get("status");

  if (!companyId)
    return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const incidents = await prisma.vehicleIncident.findMany({
    where: {
      companyId,
      ...(driverId  ? { driverId }  : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(status    ? { status: status as any } : {}),
    },
    include: {
      driver: {
        include: {
          employee: { select: { nameAr: true, nameEn: true } },
        },
      },
      vehicle:            { select: { id: true, plateNumber: true, make: true, model: true, ownershipModel: true } },
      replacementVehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      createdBy:          { select: { id: true, nameAr: true, nameEn: true } },
    },
    orderBy: { incidentDate: "desc" },
  });

  return NextResponse.json({ success: true, data: incidents });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const {
    companyId, driverId, vehicleId,
    incidentDate, incidentType,
    descriptionAr, descriptionEn,
    replacementSource, replacementVehicleId, replacementVehiclePlate,
    replacementStartDate, replacementEndDate, replacementNotes,
    garageNameAr, garagePhone,
    repairStartDate, repairEndDate, repairCost,
    notes,
  } = body;

  if (!companyId || !driverId || !vehicleId || !incidentDate || !incidentType)
    return NextResponse.json(
      { success: false, error: "الحقول المطلوبة: companyId, driverId, vehicleId, incidentDate, incidentType" },
      { status: 400 }
    );

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const incident = await prisma.vehicleIncident.create({
    data: {
      companyId, driverId, vehicleId,
      incidentDate:         new Date(incidentDate),
      incidentType,
      descriptionAr:        descriptionAr?.trim()  || null,
      descriptionEn:        descriptionEn?.trim()  || null,
      replacementSource:    replacementSource       || null,
      replacementVehicleId: replacementVehicleId    || null,
      replacementVehiclePlate: replacementVehiclePlate?.trim() || null,
      replacementStartDate: replacementStartDate ? new Date(replacementStartDate) : null,
      replacementEndDate:   replacementEndDate   ? new Date(replacementEndDate)   : null,
      replacementNotes:     replacementNotes?.trim() || null,
      garageNameAr:         garageNameAr?.trim()   || null,
      garagePhone:          garagePhone?.trim()     || null,
      repairStartDate:      repairStartDate ? new Date(repairStartDate) : null,
      repairEndDate:        repairEndDate   ? new Date(repairEndDate)   : null,
      repairCost:           repairCost != null ? repairCost : null,
      status:               "OPEN",
      notes:                notes?.trim() || null,
      createdById:          session.id,
    },
  });

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id)
    return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });

  const existing = await prisma.vehicleIncident.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!existing)
    return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

  const companyAccessError = assertCompanyAccess(session, existing.companyId);
  if (companyAccessError) return companyAccessError;

  // Build update data – only include fields that were sent
  const data: Record<string, unknown> = {};

  const dateFields = [
    "incidentDate", "replacementStartDate", "replacementEndDate",
    "repairStartDate", "repairEndDate", "resolvedDate",
  ];
  const textFields = [
    "incidentType", "descriptionAr", "descriptionEn",
    "replacementSource", "replacementVehicleId", "replacementVehiclePlate", "replacementNotes",
    "garageNameAr", "garagePhone", "status", "notes",
  ];
  const numFields = ["repairCost"];
  const vehicleFields = ["driverId", "vehicleId"];

  for (const f of [...textFields, ...vehicleFields]) {
    if (f in fields) data[f] = fields[f] === "" ? null : fields[f];
  }
  for (const f of dateFields) {
    if (f in fields) data[f] = fields[f] ? new Date(fields[f]) : null;
  }
  for (const f of numFields) {
    if (f in fields) data[f] = fields[f] != null ? Number(fields[f]) : null;
  }

  // Auto-set resolvedDate when marking RESOLVED
  if (data.status === "RESOLVED" && !data.resolvedDate) {
    data.resolvedDate = new Date();
  }

  const updated = await prisma.vehicleIncident.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });

  const existing = await prisma.vehicleIncident.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!existing)
    return NextResponse.json({ success: false, error: "السجل غير موجود" }, { status: 404 });

  const companyAccessError = assertCompanyAccess(session, existing.companyId);
  if (companyAccessError) return companyAccessError;

  await prisma.vehicleIncident.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
