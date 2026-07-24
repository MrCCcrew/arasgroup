import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const { action, rejectionReason } = await request.json();
    const { id } = await props.params;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'إجراء غير صحيح' }, { status: 400 });
    }

    if (action === 'REJECT' && !rejectionReason) {
      return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 });
    }

    const invoice = await prisma.deliveryInvoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });
    }

    // Check permission
    const canApprove = await hasPermission(
      session,
      'DELIVERY_INVOICES',
      'APPROVE',
      { companyId: invoice.companyId }
    );

    if (!canApprove) {
      return NextResponse.json({ error: 'غير مصرح بمراجعة الفواتير' }, { status: 403 });
    }

    const updated = await prisma.deliveryInvoice.update({
      where: { id },
      data: {
        reviewStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedById: session.id,
        reviewedAt: new Date(),
        rejectionReason: action === 'REJECT' ? rejectionReason : null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: action === 'APPROVE' ? 'APPROVE' : 'REJECT',
        module: 'DELIVERY_INVOICES',
        resourceId: updated.id,
        resourceType: 'DeliveryInvoice',
        companyId: invoice.companyId,
        oldValues: { reviewStatus: invoice.reviewStatus },
        newValues: { reviewStatus: updated.reviewStatus, rejectionReason },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, reviewStatus: updated.reviewStatus },
    });
  } catch (error) {
    console.error('Review invoice error:', error);
    return NextResponse.json({ error: 'فشل مراجعة الفاتورة' }, { status: 500 });
  }
}
