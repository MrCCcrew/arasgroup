import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employeeId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'معرف الجلسة مطلوب' }, { status: 400 });
    }

    const trackingSession = await prisma.driverTrackingSession.findUnique({
      where: { id: sessionId },
    });

    if (!trackingSession) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
    }

    if (trackingSession.userId !== session.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const updated = await prisma.driverTrackingSession.update({
      where: { id: sessionId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        endedAt: updated.endedAt,
      },
    });
  } catch (error) {
    console.error('End session error:', error);
    return NextResponse.json({ error: 'فشل إنهاء الجلسة' }, { status: 500 });
  }
}
