import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateDriverSession } from '@/lib/auth/driver-auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  const { error, employee } = await validateDriverSession(session);
  if (error) return error;

  try {

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
