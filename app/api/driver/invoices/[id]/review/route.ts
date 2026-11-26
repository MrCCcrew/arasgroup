import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === 'REJECTED' && !value.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rejection reason is required',
      path: ['rejectionReason'],
    });
  }
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.accountType === 'DRIVER' || session.accountType === 'CAR_WASH_WORKER') {
    return NextResponse.json({ error: 'Invoice review is not permitted for this account' }, { status: 403 });
  }

  try {
    const parsed = reviewSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review request' }, { status: 400 });
    }

    const { id } = await props.params;
    const { status, rejectionReason } = parsed.data;
    const invoice = await prisma.deliveryInvoice.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } }),
      },
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const canReview = hasPermission(session, 'DRIVER_INVOICES', status === 'APPROVED' ? 'APPROVE' : 'REJECT', {
      companyId: invoice.companyId,
    });
    if (!canReview) return NextResponse.json({ error: 'Invoice review is not permitted' }, { status: 403 });

    if (invoice.reviewStatus === status) {
      return NextResponse.json({
        success: true,
        data: { id: invoice.id, reviewStatus: invoice.reviewStatus, idempotent: true },
      });
    }

    // Reviews are final in this MVP. Repeating the same decision is safe; reversing it is rejected.
    if (invoice.reviewStatus !== 'PENDING_REVIEW') {
      return NextResponse.json({ error: 'Invoice has already been reviewed' }, { status: 409 });
    }

    const updated = await prisma.deliveryInvoice.update({
      where: { id: invoice.id },
      data: {
        reviewStatus: status,
        reviewedById: session.id,
        reviewedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        module: 'DELIVERY_INVOICES',
        resourceId: updated.id,
        resourceType: 'DeliveryInvoice',
        companyId: invoice.companyId,
        oldValues: { reviewStatus: invoice.reviewStatus },
        newValues: { reviewStatus: updated.reviewStatus },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, reviewStatus: updated.reviewStatus },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to review invoice' }, { status: 500 });
  }
}
