'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils/currency';

interface Invoice {
  id: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  imagePath: string;
  notes: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

export default function DriverInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/driver/invoices')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setInvoices(data.data || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: Invoice['reviewStatus']) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
            <Clock className="w-3 h-3" />
            قيد المراجعة
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            موافق عليها
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
            <XCircle className="w-3 h-3" />
            مرفوضة
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">فواتيري</h1>
        <Link href="/driver/invoices/upload">
          <Button size="sm">
            <Plus className="w-4 h-4 ml-1" />
            رفع فاتورة
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">جارٍ التحميل...</div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">لا توجد فواتير</p>
            <Link href="/driver/invoices/upload">
              <Button>
                <Plus className="w-4 h-4 ml-1" />
                رفع أول فاتورة
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={invoice.imagePath}
                      alt="صورة الفاتورة"
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-sm text-gray-500">
                          {new Date(invoice.invoiceDate).toLocaleDateString('ar-KW')}
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </div>
                      </div>
                      {getStatusBadge(invoice.reviewStatus)}
                    </div>

                    {invoice.notes && (
                      <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {invoice.notes}
                      </div>
                    )}

                    {invoice.reviewStatus === 'REJECTED' && invoice.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        <div className="font-medium mb-1">سبب الرفض:</div>
                        {invoice.rejectionReason}
                      </div>
                    )}

                    <div className="text-xs text-gray-400 mt-2">
                      رُفعت في {new Date(invoice.createdAt).toLocaleDateString('ar-KW')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
