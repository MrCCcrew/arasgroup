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
import { readInvoiceImage } from '@/lib/delivery/invoice-ocr';
import { useLocale } from '@/components/providers/locale-provider';

export default function UploadInvoicePage() {
  const { t } = useLocale();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState<{ text: string; amount: number | null; date: string | null } | null>(null);
  const [reading, setReading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'KWD',
    notes: '',
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      alert(t('driver.error.imageOnly'));
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert(t('driver.error.imageTooLarge'));
      return;
    }

    setFile(selectedFile);
    setOcr(null);
    setOcrMessage(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
    setReading(true);
    try {
      const result = await readInvoiceImage(selectedFile);
      setOcr(result);
      setFormData((current) => ({ ...current, amount: result.amount !== null ? result.amount.toFixed(3) : current.amount, invoiceDate: result.date ?? current.invoiceDate }));
      setOcrMessage(result.amount !== null || result.date ? t('driver.ocrSuccess') : t('driver.ocrNotFound'));
    } catch {
      setOcrMessage(t('driver.ocrFailed'));
    } finally { setReading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert(t('driver.error.chooseInvoiceImage'));
      return;
    }

    if (!formData.invoiceDate || !formData.amount || Number(formData.amount) <= 0) {
      alert(t('driver.error.completeRequired'));
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
      if (ocr?.text) formDataToSend.append('ocrText', ocr.text);
      if (ocr?.amount !== null && ocr?.amount !== undefined) formDataToSend.append('ocrAmount', String(ocr.amount));
      if (ocr?.date) formDataToSend.append('ocrDate', ocr.date);

      const res = await fetch('/api/driver/invoices', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || t('driver.error.uploadFailed'));
        setLoading(false);
        return;
      }

      router.push('/driver/invoices?uploaded=1');
    } catch (error) {
      console.error(error);
      alert(t('driver.error.generic'));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.uploadInvoice')}</h1>
          <p className="text-sm text-muted-foreground">{t('driver.uploadInvoiceDescription')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('driver.invoiceImage')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

            {preview ? (
              <div className="relative">
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={preview}
                    alt={t('driver.invoicePreview')}
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
                  {t('driver.remove')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-20"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6 ml-2" />
                  {t('driver.takePhoto')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-20"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 ml-2" />
                  {t('driver.chooseFromGallery')}
                </Button>
              </div>
            )}
            {reading && <p className="text-sm text-muted-foreground">{t('driver.readingInvoice')}</p>}
            {ocrMessage && <p className="text-sm text-muted-foreground">{ocrMessage}</p>}
            {file && !reading && <div className="space-y-2"><p className="truncate text-sm text-muted-foreground">{file.name}</p><div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()}>{t('driver.changeImage')}</Button><Button type="button" variant="destructive" onClick={() => { setFile(null); setPreview(null); setOcr(null); setOcrMessage(null); }}>{t('driver.removeImage')}</Button></div></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('driver.manualEntry')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">{t('driver.invoiceDateRequired')}</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t('driver.amountRequired')}</Label>
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
              <Label htmlFor="notes">{t('driver.notesOptional')}</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder={t('driver.notesPlaceholder')}
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
            {t('driver.cancel')}
          </Button>

          <Button type="submit" disabled={loading || !file}>
            {loading ? (
              t('driver.uploading')
            ) : (
              <>
                <Check className="w-4 h-4 ml-1" />
                {t('driver.uploadInvoice')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
