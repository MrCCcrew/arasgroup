import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
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

    const { deviceInfo } = await request.json();

    // End any active sessions first
    await prisma.driverTrackingSession.updateMany({
      where: {
        userId: session.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    // Create new session
    const trackingSession = await prisma.driverTrackingSession.create({
      data: {
        userId: session.id,
        employeeId: employee.id,
        companyId: employee.companyId,
        driverId: employee.driver?.id || null,
        carWashWorkerId: employee.carWashWorker?.id || null,
        status: 'ACTIVE',
        deviceInfo,
        consentedAt: new Date(),
        consentVersion: '1.0',
        consentLocale: 'ar',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: trackingSession.id,
        status: trackingSession.status,
        startedAt: trackingSession.startedAt,
      },
    });
  } catch (error) {
    console.error('Start session error:', error);
    return NextResponse.json({ error: 'فشل بدء الجلسة' }, { status: 500 });
  }
}
