'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function DriverHomePage() {
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/driver/invoices')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const invoices = data.data || [];
          setStats({
            pending: invoices.filter((inv: any) => inv.reviewStatus === 'PENDING_REVIEW').length,
            approved: invoices.filter((inv: any) => inv.reviewStatus === 'APPROVED').length,
            rejected: invoices.filter((inv: any) => inv.reviewStatus === 'REJECTED').length,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">لوحة السائق</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              قيد المراجعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {loading ? '...' : stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              موافق عليها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {loading ? '...' : stats.approved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              مرفوضة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {loading ? '...' : stats.rejected}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Link href="/driver/invoices/upload">
          <Button className="w-full h-14" size="lg">
            <FileText className="w-5 h-5 ml-2" />
            رفع فاتورة جديدة
          </Button>
        </Link>

        <Link href="/driver/invoices">
          <Button variant="outline" className="w-full h-14" size="lg">
            <FileText className="w-5 h-5 ml-2" />
            فواتيري
          </Button>
        </Link>

        <Link href="/driver/tracking">
          <Button variant="outline" className="w-full h-14" size="lg">
            <MapPin className="w-5 h-5 ml-2" />
            التتبع
          </Button>
        </Link>
      </div>
    </div>
  );
}
