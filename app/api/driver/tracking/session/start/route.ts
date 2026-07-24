import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateDriverSession } from '@/lib/auth/driver-auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error, employee } = await validateDriverSession(session);
  if (error || !employee) return error ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const activeSession = await prisma.driverTrackingSession.findFirst({
    where: { userId: session.id, companyId: employee.companyId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
    include: { locationPoints: { orderBy: { recordedAt: 'desc' }, take: 1 }, _count: { select: { locationPoints: true } } },
  });
  if (!activeSession) return NextResponse.json({ success: true, data: null });
  const point = activeSession.locationPoints[0];
  return NextResponse.json({ success: true, data: { id: activeSession.id, status: activeSession.status, startedAt: activeSession.startedAt, locationCount: activeSession._count.locationPoints, lastLocation: point ? { lat: Number(point.latitude), lng: Number(point.longitude) } : null } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { error, employee } = await validateDriverSession(session);
  if (error) return error;

  try {
    const body = await request.json() as {
      deviceInfo?: string;
      initialLocation?: { clientGeneratedId?: string; latitude?: number; longitude?: number; accuracy?: number | null; altitude?: number | null; heading?: number | null; speed?: number | null; recordedAt?: string };
    };
    const initialLocation = body.initialLocation;
    const clientGeneratedId = initialLocation?.clientGeneratedId;
    const latitude = initialLocation?.latitude;
    const longitude = initialLocation?.longitude;
    const recordedAt = initialLocation?.recordedAt ? new Date(initialLocation.recordedAt) : null;

    if (!clientGeneratedId || typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude) || !recordedAt || Number.isNaN(recordedAt.getTime())) {
      return NextResponse.json({ error: 'يجب إرسال أول موقع صالح قبل بدء التتبع' }, { status: 400 });
    }

    const trackingSession = await prisma.$transaction(async (tx) => {
      await tx.driverTrackingSession.updateMany({
        where: { userId: session.id, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      const createdSession = await tx.driverTrackingSession.create({
        data: {
          userId: session.id,
          employeeId: employee.id,
          companyId: employee.companyId,
          driverId: employee.driver?.id || null,
          carWashWorkerId: employee.carWashWorker?.id || null,
          status: 'ACTIVE',
          deviceInfo: body.deviceInfo,
          consentedAt: new Date(),
          consentVersion: '1.0',
          consentLocale: 'ar',
        },
      });

      await tx.driverLocationPoint.create({
        data: {
          sessionId: createdSession.id,
          companyId: employee.companyId,
          employeeId: employee.id,
          driverId: employee.driver?.id || null,
          carWashWorkerId: employee.carWashWorker?.id || null,
          clientGeneratedId,
          latitude,
          longitude,
          accuracy: initialLocation.accuracy,
          altitude: initialLocation.altitude,
          heading: initialLocation.heading,
          speed: initialLocation.speed,
          recordedAt,
        },
      });

      return createdSession;
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
