import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.employeeId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const { sessionId, locations } = await request.json();

    if (!sessionId || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 });
    }

    // Limit batch size
    if (locations.length > 50) {
      return NextResponse.json({ error: 'Batch size too large (max 50)' }, { status: 400 });
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

    if (trackingSession.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'الجلسة غير نشطة' }, { status: 400 });
    }

    // Validate and sanitize locations
    const now = Date.now();
    const points = locations.map((loc: any) => {
      const recordedAt = new Date(loc.recordedAt);

      // Reject future timestamps (more than 1 minute ahead)
      if (recordedAt.getTime() > now + 60000) {
        throw new Error('Invalid recordedAt: timestamp in future');
      }

      // Reject very old timestamps (more than 24 hours old)
      if (recordedAt.getTime() < now - 86400000) {
        throw new Error('Invalid recordedAt: timestamp too old');
      }

      return {
        sessionId,
        companyId: trackingSession.companyId,
        employeeId: trackingSession.employeeId,
        driverId: trackingSession.driverId,
        carWashWorkerId: trackingSession.carWashWorkerId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        altitude: loc.altitude,
        heading: loc.heading,
        speed: loc.speed,
        recordedAt,
        clientGeneratedId: loc.clientGeneratedId,
      };
    });

    // Use createMany with skipDuplicates for idempotency
    const result = await prisma.driverLocationPoint.createMany({
      data: points,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      data: { saved: result.count },
    });
  } catch (error) {
    console.error('Save location error:', error);
    return NextResponse.json({ error: 'فشل حفظ الموقع' }, { status: 500 });
  }
}
