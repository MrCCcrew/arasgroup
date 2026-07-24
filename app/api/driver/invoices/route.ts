import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { uploadToR2 } from '@/lib/storage/r2';
import { nanoid } from 'nanoid';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.employeeId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  if (session.accountType !== 'DRIVER' && session.accountType !== 'CAR_WASH_WORKER') {
    return NextResponse.json({ error: 'هذا الحساب غير مصرح' }, { status: 403 });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      include: { driver: true, carWashWorker: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    const invoices = await prisma.deliveryInvoice.findMany({
      where: {
        companyId: employee.companyId,
        employeeId: employee.id,
        deletedAt: null,
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      data: invoices.map(inv => ({
        id: inv.id,
        invoiceDate: inv.invoiceDate,
        amount: Number(inv.amount),
        currency: inv.currency,
        imagePath: inv.imagePath,
        notes: inv.notes,
        reviewStatus: inv.reviewStatus,
        rejectionReason: inv.rejectionReason,
        uploadSource: inv.uploadSource,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'فشل جلب الفواتير' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employeeId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  if (session.accountType !== 'DRIVER' && session.accountType !== 'CAR_WASH_WORKER') {
    return NextResponse.json({ error: 'هذا الحساب غير مصرح برفع الفواتير' }, { status: 403 });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      include: { driver: true, carWashWorker: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientGeneratedId = formData.get('clientGeneratedId') as string;
    const invoiceDate = formData.get('invoiceDate') as string;
    const amount = Number(formData.get('amount'));
    const currency = (formData.get('currency') as string) || 'KWD';
    const notes = (formData.get('notes') as string) || null;

    if (!file) {
      return NextResponse.json({ error: 'صورة الفاتورة مطلوبة' }, { status: 400 });
    }

    if (!invoiceDate || !amount || amount <= 0) {
      return NextResponse.json({ error: 'بيانات الفاتورة غير كاملة' }, { status: 400 });
    }

    // Check for duplicate (must belong to same user)
    if (clientGeneratedId) {
      const existing = await prisma.deliveryInvoice.findFirst({
        where: {
          clientGeneratedId,
          employeeId: employee.id,
          companyId: employee.companyId,
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          data: { id: existing.id },
          message: 'الفاتورة موجودة مسبقًا',
        });
      }
    }

    // Validate file
    if (!IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'نوع الصورة غير مدعوم (JPG/PNG/WEBP)' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الصورة يتجاوز 10 ميجابايت' }, { status: 400 });
    }

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1];
    const key = `driver-invoices/${employee.companyId}/${clientGeneratedId || nanoid(14)}.${ext}`;
    const imagePath = await uploadToR2(key, buffer, file.type);

    // Create invoice (handle race condition)
    let invoice;
    try {
      invoice = await prisma.deliveryInvoice.create({
        data: {
          companyId: employee.companyId,
          targetType: employee.driver ? 'DRIVER' : 'EMPLOYEE',
          driverId: employee.driver?.id || null,
          employeeId: employee.id,
          invoiceDate: new Date(`${invoiceDate}T12:00:00.000Z`),
          amount,
          currency,
          imagePath,
          storageKey: key,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          notes,
          uploadSource: 'DRIVER_WEB',
          reviewStatus: 'PENDING_REVIEW',
          clientGeneratedId: clientGeneratedId || null,
          createdById: session.id,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === 'P2002' && clientGeneratedId) {
        const existingInvoice = await prisma.deliveryInvoice.findFirst({
          where: {
            clientGeneratedId,
            employeeId: employee.id,
            companyId: employee.companyId,
          },
        });

        if (existingInvoice) {
          return NextResponse.json({
            success: true,
            data: { id: existingInvoice.id },
            message: 'الفاتورة موجودة مسبقًا',
          });
        }
      }
      throw error;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'CREATE',
        module: 'DRIVER_INVOICES',
        resourceId: invoice.id,
        resourceType: 'DeliveryInvoice',
        companyId: employee.companyId,
        newValues: { uploadSource: 'DRIVER_WEB' },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: invoice.id },
    }, { status: 201 });
  } catch (error) {
    console.error('Upload invoice error:', error);
    return NextResponse.json({ error: 'فشل رفع الفاتورة' }, { status: 500 });
  }
}
