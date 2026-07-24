'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import Image from 'next/image';

export default function UploadInvoicePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'KWD',
    notes: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      alert('الرجاء اختيار صورة');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('حجم الصورة يتجاوز 10 ميجابايت');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('الرجاء اختيار صورة الفاتورة');
      return;
    }

    if (!formData.invoiceDate || !formData.amount || Number(formData.amount) <= 0) {
      alert('الرجاء إكمال البيانات المطلوبة');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      formDataToSend.append('clientGeneratedId', nanoid(16));
      formDataToSend.append('invoiceDate', formData.invoiceDate);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('currency', formData.currency);
      if (formData.notes) {
        formDataToSend.append('notes', formData.notes);
      }

      const res = await fetch('/api/driver/invoices', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || 'فشل رفع الفاتورة');
        setLoading(false);
        return;
      }

      router.push('/driver/invoices?uploaded=1');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء رفع الفاتورة');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">رفع فاتورة جديدة</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">صورة الفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {preview ? (
              <div className="relative">
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={preview}
                    alt="معاينة الفاتورة"
                    fill
                    className="object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 left-2"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="w-4 h-4 ml-1" />
                  إزالة
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6 ml-2" />
                  التقاط بالكاميرا
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-20"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 ml-2" />
                  اختيار من المعرض
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">بيانات الفاتورة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">تاريخ الفاتورة *</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ (KWD) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.001"
                placeholder="0.000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="أضف ملاحظات إضافية..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            إلغاء
          </Button>

          <Button type="submit" disabled={loading || !file}>
            {loading ? (
              'جارٍ الرفع...'
            ) : (
              <>
                <Check className="w-4 h-4 ml-1" />
                رفع الفاتورة
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
