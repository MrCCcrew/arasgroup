import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { validateDriverSession } from '@/lib/auth/driver-auth';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; expiresAt: number }>();

function isRateLimited(userId: string) {
  const record = failedAttempts.get(userId);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) { failedAttempts.delete(userId); return false; }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailure(userId: string) {
  const now = Date.now();
  const current = failedAttempts.get(userId);
  if (!current || current.expiresAt <= now) failedAttempts.set(userId, { count: 1, expiresAt: now + WINDOW_MS });
  else failedAttempts.set(userId, { ...current, count: current.count + 1 });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  const { error, employee } = await validateDriverSession(session);
  if (error || !employee) return error ?? NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });

  try {
    const body = await request.json() as { sessionId?: string; masterPassword?: string };
    if (!body.sessionId || !body.masterPassword) return NextResponse.json({ code: 'PASSWORD_REQUIRED' }, { status: 400 });
    if (isRateLimited(session.id)) return NextResponse.json({ code: 'TOO_MANY_ATTEMPTS' }, { status: 429 });

    const passwordHash = process.env.DRIVER_TRACKING_STOP_PASSWORD_HASH;
    if (!passwordHash) return NextResponse.json({ code: 'STOP_NOT_AVAILABLE' }, { status: 503 });

    const trackingSession = await prisma.driverTrackingSession.findFirst({
      where: { id: body.sessionId, userId: session.id, companyId: employee.companyId },
    });
    if (!trackingSession) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });

    const validPassword = await bcrypt.compare(body.masterPassword, passwordHash);
    if (!validPassword) { recordFailure(session.id); return NextResponse.json({ code: 'INCORRECT_PASSWORD' }, { status: 401 }); }
    failedAttempts.delete(session.id);

    if (trackingSession.status === 'ENDED') {
      return NextResponse.json({ success: true, data: { id: trackingSession.id, status: trackingSession.status, endedAt: trackingSession.endedAt } });
    }
    // Avoid a race with a concurrent session refresh or cleanup. updateMany is
    // idempotent and does not throw when the row was just ended elsewhere.
    await prisma.driverTrackingSession.updateMany({
      where: { id: trackingSession.id, userId: session.id, companyId: employee.companyId, status: { not: 'ENDED' } },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    const endedSession = await prisma.driverTrackingSession.findUnique({ where: { id: trackingSession.id }, select: { id: true, status: true, endedAt: true } });
    if (!endedSession || endedSession.status !== 'ENDED') return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ success: true, data: endedSession });
  } catch (error) {
    console.error('Stop tracking session error:', error);
    return NextResponse.json({ code: 'STOP_FAILED' }, { status: 500 });
  }
}
