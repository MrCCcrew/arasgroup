import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { uploadToR2 } from "@/lib/storage/r2";

interface Ctx {
  params: Promise<{ invoiceId: string }>;
}

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE = 10 * 1024 * 1024;

async function loadInvoice(invoiceId: string) {
  return prisma.deliveryInvoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      targetType: true,
      driverId: true,
      employeeId: true,
      invoiceDate: true,
      amount: true,
      currency: true,
      imagePath: true,
      storageKey: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      ocrText: true,
      ocrAmount: true,
      ocrDate: true,
      notes: true,
    },
  });
}

const patchSchema = z.object({
  targetType: z.enum(["DRIVER", "EMPLOYEE"]).optional(),
  driverId: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  invoiceDate: z.string().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().nullable().optional(),
  ocrText: z.string().nullable().optional(),
  ocrAmount: z.number().min(0).nullable().optional(),
  ocrDate: z.string().nullable().optional(),
});

type PatchPayload = z.infer<typeof patchSchema> & { file?: File | null };

async function parsePatchPayload(request: NextRequest): Promise<PatchPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      file: (form.get("file") as File | null) ?? null,
      targetType: (form.get("targetType") as "DRIVER" | "EMPLOYEE" | null) ?? undefined,
      driverId: form.has("driverId") ? ((form.get("driverId") as string | null) || null) : undefined,
      employeeId: form.has("employeeId") ? ((form.get("employeeId") as string | null) || null) : undefined,
      invoiceDate: form.has("invoiceDate") ? ((form.get("invoiceDate") as string | null) ?? "") : undefined,
      amount: form.has("amount") ? Number(form.get("amount")) : undefined,
      currency: form.has("currency") ? ((form.get("currency") as string | null) ?? "") : undefined,
      notes: form.has("notes") ? ((form.get("notes") as string | null) || null) : undefined,
      ocrText: form.has("ocrText") ? ((form.get("ocrText") as string | null) || null) : undefined,
      ocrAmount: form.has("ocrAmount") ? Number(form.get("ocrAmount")) : undefined,
      ocrDate: form.has("ocrDate") ? ((form.get("ocrDate") as string | null) || null) : undefined,
    };
  }

  return { ...(await request.json()), file: null };
}

async function assertTargetBelongsToCompany(
  companyId: string,
  targetType: "DRIVER" | "EMPLOYEE",
  driverId: string | null,
  employeeId: string | null,
) {
  if (targetType === "DRIVER") {
    if (!driverId) return "اختر السائق";
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        employee: { companyId, isDeleted: false },
      },
      select: { id: true },
    });
    return driver ? null : "السائق غير موجود";
  }

  if (!employeeId) return "اختر الموظف";
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, isDeleted: false },
    select: { id: true },
  });
  return employee ? null : "الموظف غير موجود";
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { invoiceId } = await params;
    const invoice = await loadInvoice(invoiceId);
    if (!invoice) {
      return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
    }

    const accessError = assertCompanyAccess(session, invoice.companyId);
    if (accessError) return accessError;

    const rawPayload = await parsePatchPayload(request);
    const parsed = patchSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const d = parsed.data;
    const nextTargetType = d.targetType ?? invoice.targetType;
    const nextDriverId = nextTargetType === "DRIVER"
      ? (d.driverId !== undefined ? d.driverId : invoice.driverId)
      : null;
    const nextEmployeeId = nextTargetType === "EMPLOYEE"
      ? (d.employeeId !== undefined ? d.employeeId : invoice.employeeId)
      : null;

    const targetError = await assertTargetBelongsToCompany(invoice.companyId, nextTargetType, nextDriverId, nextEmployeeId);
    if (targetError) {
      return NextResponse.json({ success: false, error: targetError }, { status: 400 });
    }

    const nextInvoiceDateRaw = d.invoiceDate ?? invoice.invoiceDate.toISOString().slice(0, 10);
    const nextInvoiceDate = new Date(`${nextInvoiceDateRaw}T12:00:00.000`);
    if (Number.isNaN(nextInvoiceDate.getTime())) {
      return NextResponse.json({ success: false, error: "تاريخ الفاتورة غير صالح" }, { status: 400 });
    }

    const file = rawPayload.file ?? null;
    let uploadedImage:
      | {
          imagePath: string;
          storageKey: string;
          originalFileName: string;
          mimeType: string;
          fileSize: number;
        }
      | undefined;

    if (file) {
      const ext = IMAGE_EXT[file.type];
      if (!ext) {
        return NextResponse.json({ success: false, error: "نوع الصورة غير مدعوم (JPG/PNG/WEBP)" }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ success: false, error: "حجم الصورة يتجاوز 10 ميجابايت" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const key = `delivery-invoices/${invoice.companyId}/${nanoid(14)}.${ext}`;
      const imagePath = await uploadToR2(key, buffer, file.type);
      uploadedImage = {
        imagePath,
        storageKey: key,
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      };
    }

    const updated = await prisma.deliveryInvoice.update({
      where: { id: invoiceId },
      data: {
        targetType: nextTargetType,
        driverId: nextTargetType === "DRIVER" ? nextDriverId : null,
        employeeId: nextTargetType === "EMPLOYEE" ? nextEmployeeId : null,
        invoiceDate: nextInvoiceDate,
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.currency !== undefined ? { currency: d.currency } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(uploadedImage ?? {}),
        ...(file
          ? {
              ocrText: d.ocrText ?? null,
              ocrAmount: d.ocrAmount ?? null,
              ocrDate: d.ocrDate ? new Date(`${d.ocrDate}T12:00:00.000`) : null,
            }
          : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId: invoice.companyId,
        action: "UPDATE_DELIVERY_INVOICE",
        module: "delivery-invoices",
        resourceId: invoiceId,
        resourceType: "DeliveryInvoice",
        oldValues: {
          targetType: invoice.targetType,
          driverId: invoice.driverId,
          employeeId: invoice.employeeId,
          invoiceDate: invoice.invoiceDate,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          imagePath: invoice.imagePath,
          notes: invoice.notes,
        },
        newValues: {
          targetType: updated.targetType,
          driverId: updated.driverId,
          employeeId: updated.employeeId,
          invoiceDate: updated.invoiceDate,
          amount: Number(updated.amount),
          currency: updated.currency,
          imagePath: updated.imagePath,
          notes: updated.notes,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في التعديل" }, { status: 400 });
  }
}

// حذف ناعم - لا يحذف نهائيًا.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { invoiceId } = await params;
    const invoice = await loadInvoice(invoiceId);
    if (!invoice) return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });

    const accessError = assertCompanyAccess(session, invoice.companyId);
    if (accessError) return accessError;

    await prisma.deliveryInvoice.update({
      where: { id: invoiceId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في الحذف" }, { status: 400 });
  }
}
