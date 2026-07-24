'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, MapPin, AlertCircle } from 'lucide-react';
import { nanoid } from 'nanoid';

interface TrackingSession {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  startedAt: string;
}

export default function DriverTrackingPage() {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationCount, setLocationCount] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const locationQueueRef = useRef<any[]>([]);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tracking && session) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [tracking, session]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          clientGeneratedId: nanoid(16),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          recordedAt: new Date(position.timestamp).toISOString(),
        };

        locationQueueRef.current.push(point);
        setLastLocation({ lat: point.latitude, lng: point.longitude });
        setLocationCount(prev => prev + 1);

        if (locationQueueRef.current.length >= 10) {
          flushLocations();
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(`خطأ في الموقع: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    flushIntervalRef.current = setInterval(() => {
      flushLocations();
    }, 30000);
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    flushLocations();
  };

  const flushLocations = async () => {
    if (locationQueueRef.current.length === 0 || !session) return;

    const batch = [...locationQueueRef.current];
    locationQueueRef.current = [];

    try {
      await fetch('/api/driver/tracking/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          locations: batch,
        }),
      });
    } catch (err) {
      console.error('Failed to send locations:', err);
      locationQueueRef.current = [...batch, ...locationQueueRef.current];
    }
  };

  const handleStartSession = async () => {
    try {
      const res = await fetch('/api/driver/tracking/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceInfo: navigator.userAgent,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'فشل بدء الجلسة');
        return;
      }

      setSession(data.data);
      setTracking(true);
      setError(null);
      setLocationCount(0);
    } catch (err) {
      console.error(err);
      setError('فشل بدء الجلسة');
    }
  };

  const handleEndSession = async () => {
    if (!session) return;

    setTracking(false);

    try {
      await fetch('/api/driver/tracking/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });

      setSession(null);
      setLastLocation(null);
      setLocationCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">التتبع</h1>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            حالة التتبع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">الحالة:</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                tracking
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {tracking ? 'جارٍ التتبع' : 'متوقف'}
            </span>
          </div>

          {tracking && session && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">بدأت في:</span>
                <span className="text-sm font-medium">
                  {new Date(session.startedAt).toLocaleTimeString('ar-KW')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">النقاط المرسلة:</span>
                <span className="text-sm font-medium">{locationCount}</span>
              </div>

              {lastLocation && (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  آخر موقع: {lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {!tracking ? (
          <Button
            className="w-full h-14"
            size="lg"
            onClick={handleStartSession}
          >
            <Play className="w-5 h-5 ml-2" />
            بدء التتبع
          </Button>
        ) : (
          <Button
            variant="destructive"
            className="w-full h-14"
            size="lg"
            onClick={handleEndSession}
          >
            <Square className="w-5 h-5 ml-2" />
            إيقاف التتبع
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">معلومات مهمة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-gray-600">
          <p>• يجب السماح للمتصفح بالوصول إلى موقعك</p>
          <p>• التتبع يعمل فقط عندما تكون الصفحة مفتوحة</p>
          <p>• يتم إرسال الموقع كل 30 ثانية أو عند 10 نقاط</p>
          <p>• تأكد من شحن البطارية قبل بدء الجلسة</p>
        </CardContent>
      </Card>
    </div>
  );
}
