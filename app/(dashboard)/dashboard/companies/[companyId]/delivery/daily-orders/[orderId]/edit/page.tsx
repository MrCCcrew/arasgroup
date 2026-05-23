"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Save, Loader2, AlertCircle } from "lucide-react";

interface Order {
  id: string;
  date: string;
  ordersCount: number;
  rating: string | number | null;
  notes: string | null;
  walletAmount: number | null;
  driver: { employee: { nameAr: string } };
  contract: { nameAr: string; platform: string };
}

export default function EditDailyOrderPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const orderId = params.orderId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const [ordersCount, setOrdersCount] = useState("");
  const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [walletAmount, setWalletAmount] = useState("");

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/delivery/daily-orders/${orderId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!json.success) throw new Error(json.error ?? "فشل في تحميل البيانات");
        return json.data as Order;
      })
      .then((o) => {
        setOrder(o);
        setOrdersCount(String(o.ordersCount ?? 0));
        setRating(o.rating != null ? String(Number(o.rating)) : "");
        setNotes(o.notes ?? "");
        setWalletAmount(o.walletAmount != null ? String(o.walletAmount) : "");
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : "فشل في تحميل البيانات");
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/delivery/daily-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordersCount: Number(ordersCount),
          rating: rating ? Number(rating) : null,
          notes: notes || null,
          walletAmount: walletAmount ? Number(walletAmount) : null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push(`/dashboard/companies/${companyId}/delivery/daily-orders`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "فشل في الحفظ");
      setSaving(false);
    }
  }

  // ── حالة التحميل ──
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">جاري تحميل البيانات...</span>
      </div>
    );
  }

  // ── حالة الخطأ في التحميل ──
  if (fetchError || !order) {
    return (
      <div className="page-container max-w-lg">
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-base font-medium text-red-600">{fetchError ?? "لم يتم العثور على السجل"}</p>
          <Link
            href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            العودة للأوردرات اليومية
          </Link>
        </div>
      </div>
    );
  }

  // ── الـ form ──
  return (
    <div>
      <div className="border-b bg-card px-6 py-4">
        <h1 className="text-lg font-bold">تعديل تسجيل يومي</h1>
        <p className="text-sm text-muted-foreground">
          {order.driver.employee.nameAr} — {order.contract.nameAr} —{" "}
          {new Date(order.date).toLocaleDateString("ar-KW")}
        </p>
      </div>

      <div className="page-container max-w-lg space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          العودة للأوردرات اليومية
        </Link>

        {saveError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}

        <form onSubmit={handleSubmit} className="section-card space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              عدد الطلبات <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              value={ordersCount}
              onChange={(e) => setOrdersCount(e.target.value)}
              className="input-field w-full"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">التقييم (1–5)</label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="input-field w-full"
              dir="ltr"
              placeholder="اختياري"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              تحصيل اليوم (د.ك)
              <span className="mr-1 text-xs font-normal text-muted-foreground">— النقد اللي جمعه السائق</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={walletAmount}
              onChange={(e) => setWalletAmount(e.target.value)}
              className="input-field w-full"
              dir="ltr"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full"
              rows={3}
              placeholder="اختياري..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/dashboard/companies/${companyId}/delivery/daily-orders`}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
