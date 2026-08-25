import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth/session";
import { validateDriverSession } from "@/lib/auth/driver-auth";
import { prisma } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage/r2";

const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const maxSize = 10 * 1024 * 1024;

export async function GET() {
  const session = await getSession(); const { error, employee } = await validateDriverSession(session); if (error || !employee?.driver) return error!;
  const rows = await prisma.driverDepositSubmission.findMany({ where: { driverId: employee.driver.id, deletedAt: null }, orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  const session = await getSession(); const { error, employee } = await validateDriverSession(session); if (error || !employee?.driver) return error!;
  try {
    const form = await request.formData(); const file = form.get("file"); const amount = Number(form.get("amount")); const depositDate = String(form.get("depositDate") ?? ""); const notes = String(form.get("notes") ?? "") || null; const reference = String(form.get("transactionReference") ?? "") || null;
    if (!(file instanceof File) || !imageTypes.includes(file.type) || file.size > maxSize) return NextResponse.json({ success: false, error: "صورة إيصال الإيداع مطلوبة وبحد أقصى 10 ميجابايت." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(new Date(depositDate).getTime())) return NextResponse.json({ success: false, error: "أدخل مبلغًا وتاريخًا صحيحين." }, { status: 400 });
    const ext = file.type.split("/")[1]; const key = `driver-deposits/${employee.companyId}/${employee.driver.id}/${nanoid(14)}.${ext}`;
    const imagePath = await uploadToR2(key, Buffer.from(await file.arrayBuffer()), file.type);
    const row = await prisma.driverDepositSubmission.create({ data: { driverId: employee.driver.id, companyId: employee.companyId, amount, depositDate: new Date(`${depositDate}T12:00:00.000Z`), imagePath, storageKey: key, originalFileName: file.name, mimeType: file.type, fileSize: file.size, notes, transactionReference: reference, createdById: session!.id } });
    await prisma.auditLog.create({ data: { userId: session!.id, companyId: employee.companyId, action: "CREATE", module: "DRIVER_INVOICES", resourceId: row.id, resourceType: "DriverDepositSubmission" } });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (cause) { console.error("Driver deposit upload failed", cause); return NextResponse.json({ success: false, error: "تعذر رفع إيصال الإيداع." }, { status: 500 }); }
}
