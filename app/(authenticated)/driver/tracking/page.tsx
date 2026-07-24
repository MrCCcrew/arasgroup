'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, MapPin, Play, RotateCcw, Square } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrackingSession { id: string; status: 'ACTIVE' | 'PAUSED' | 'ENDED'; startedAt: string; }
interface TrackingPoint { clientGeneratedId: string; latitude: number; longitude: number; accuracy: number | null; altitude: number | null; heading: number | null; speed: number | null; recordedAt: string; }

const isIPhone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

function pointFromPosition(position: GeolocationPosition): TrackingPoint {
  return {
    clientGeneratedId: nanoid(16), latitude: position.coords.latitude, longitude: position.coords.longitude,
    accuracy: position.coords.accuracy, altitude: position.coords.altitude, heading: position.coords.heading,
    speed: position.coords.speed, recordedAt: new Date(position.timestamp).toISOString(),
  };
}

function geolocationMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'تم رفض إذن الموقع. فعّل إذن الموقع للمتصفح ثم اضغط إعادة المحاولة.';
    case error.POSITION_UNAVAILABLE:
      return 'تعذر تحديد موقعك حاليًا. تأكد من تشغيل خدمات الموقع وحاول مرة أخرى.';
    case error.TIMEOUT:
      return 'انتهت مهلة تحديد الموقع. انتقل إلى مكان بإشارة أفضل ثم أعد المحاولة.';
    default:
      return 'تعذر الحصول على موقعك حاليًا. حاول مرة أخرى.';
  }
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'number';
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true, maximumAge: 0, timeout: 10000,
  }));
}

export default function DriverTrackingPage() {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [tracking, setTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationCount, setLocationCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const locationQueueRef = useRef<TrackingPoint[]>([]);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopWatch = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
    watchIdRef.current = null;
    flushIntervalRef.current = null;
  };

  const endRemoteSession = async (sessionId: string) => {
    await fetch('/api/driver/tracking/session/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
  };

  const sendPoints = async (sessionId: string, points: TrackingPoint[]) => {
    const response = await fetch('/api/driver/tracking/location', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, locations: points }),
    });
    if (!response.ok) throw new Error('Location upload failed');
  };

  const flushLocations = async () => {
    if (!session || locationQueueRef.current.length === 0) return;
    const points = [...locationQueueRef.current];
    locationQueueRef.current = [];
    try { await sendPoints(session.id, points); }
    catch { locationQueueRef.current = [...points, ...locationQueueRef.current]; }
  };

  const endTrackingForLocationError = async (locationError: GeolocationPositionError) => {
    stopWatch();
    const activeSession = session;
    locationQueueRef.current = [];
    setTracking(false);
    setSession(null);
    setLastLocation(null);
    setLocationCount(0);
    setError(geolocationMessage(locationError));
    if (activeSession) await endRemoteSession(activeSession.id);
  };

  const startWatch = () => {
    if (!session || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = pointFromPosition(position);
        locationQueueRef.current.push(point);
        setLastLocation({ lat: point.latitude, lng: point.longitude });
        setLocationCount((count) => count + 1);
        if (locationQueueRef.current.length >= 10) void flushLocations();
      },
      (locationError) => { void endTrackingForLocationError(locationError); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    flushIntervalRef.current = setInterval(() => { void flushLocations(); }, 30000);
  };

  useEffect(() => {
    if (tracking && session) startWatch();
    return stopWatch;
  }, [tracking, session]);

  const handleStartSession = async () => {
    if (!navigator.geolocation) { setError('المتصفح لا يدعم تحديد الموقع.'); return; }
    setStarting(true);
    setError(null);
    try {
      const initialPosition = await currentPosition();
      const initialPoint = pointFromPosition(initialPosition);
      const startResponse = await fetch('/api/driver/tracking/session/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceInfo: navigator.userAgent, initialLocation: initialPoint }),
      });
      const startPayload = await startResponse.json();
      if (!startResponse.ok || !startPayload.success) throw new Error('تعذر بدء جلسة التتبع.');
      const startedSession = startPayload.data as TrackingSession;
      setSession(startedSession);
      setLastLocation({ lat: initialPoint.latitude, lng: initialPoint.longitude });
      setLocationCount(1);
      setTracking(true);
    } catch (startError: unknown) {
      if (isGeolocationError(startError)) setError(geolocationMessage(startError));
      else setError(startError instanceof Error ? startError.message : 'تعذر بدء التتبع.');
    } finally { setStarting(false); }
  };

  const handleEndSession = async () => {
    if (!session) return;
    stopWatch();
    await flushLocations();
    await endRemoteSession(session.id);
    locationQueueRef.current = [];
    setTracking(false); setSession(null); setLastLocation(null); setLocationCount(0);
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">التتبع</h1>
    {error && <Card className="border-red-200 bg-red-50"><CardContent className="space-y-3 p-4"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><p className="text-sm text-red-800">{error}</p></div>{isIPhone() && <p className="text-sm text-red-800">على iPhone/Safari: Settings &gt; Privacy &amp; Security &gt; Location Services &gt; Safari Websites &gt; While Using the App.</p>}<Button variant="outline" size="sm" onClick={handleStartSession} disabled={starting || tracking}><RotateCcw className="ms-2 h-4 w-4" />إعادة المحاولة</Button></CardContent></Card>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-5 w-5" />حالة التتبع</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm text-gray-600">الحالة:</span><span className={`rounded-full px-3 py-1 text-sm font-medium ${tracking ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{tracking ? 'جارٍ التتبع' : 'متوقف'}</span></div>{tracking && session && <><div className="flex items-center justify-between"><span className="text-sm text-gray-600">بدأت في:</span><span className="text-sm font-medium">{new Date(session.startedAt).toLocaleTimeString('ar-KW')}</span></div><div className="flex items-center justify-between"><span className="text-sm text-gray-600">النقاط المرسلة:</span><span className="text-sm font-medium">{locationCount}</span></div>{lastLocation && <div className="rounded bg-gray-50 p-2 text-xs text-gray-500">آخر موقع: {lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}</div>}</>}</CardContent></Card>
    {!tracking ? <Button className="h-14 w-full" size="lg" onClick={handleStartSession} disabled={starting}><Play className="ms-2 h-5 w-5" />{starting ? 'جارٍ التحقق من الموقع...' : 'بدء التتبع'}</Button> : <Button variant="destructive" className="h-14 w-full" size="lg" onClick={handleEndSession}><Square className="ms-2 h-5 w-5" />إيقاف التتبع</Button>}
    <Card><CardHeader><CardTitle className="text-sm">معلومات مهمة</CardTitle></CardHeader><CardContent className="space-y-2 text-xs text-gray-600"><p>• يجب السماح للمتصفح بالوصول إلى موقعك قبل بدء التتبع.</p><p>• لا تبدأ جلسة التتبع إلا بعد إرسال أول موقع بنجاح.</p><p>• التتبع يعمل فقط عند بقاء الصفحة مفتوحة.</p></CardContent></Card>
  </div>;
}
