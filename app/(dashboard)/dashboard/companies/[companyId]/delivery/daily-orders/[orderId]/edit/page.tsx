"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Save, Loader2, AlertCircle } from "lucide-react";

type WorkStatus = "WORKED" | "ON_LEAVE" | "VEHICLE_BREAKDOWN" | "NO_SHIFTS" | "MISSED_SHIFT" | "LATE_LOGIN" | "ABSENT";

interface Order {
  id: string;
  driverId: string;
  date: string;
  ordersCount: number;
  tips: string | number | null;
  notes: string | null;
  walletAmount: number | null;
  workStatus: WorkStatus;
  operatedAsDriverId: string | null;
  driver: { employee: { nameAr: string } };
  operatedAsDriver: { employee: { nameAr: string } } | null;
  contract: { nameAr: string; platform: string };
}

interface DriverOption {
  id: string;
  employee: { nameAr: string; isActive: boolean };
}

const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  WORKED: "عمل",
  ON_LEAVE: "إجازة",
  VEHICLE_BREAKDOWN: "عطل سيارة",
  NO_SHIFTS: "بدون شيفتات",
  MISSED_SHIFT: "عنده شيفت ولم يعمل",
  LATE_LOGIN: "تأخر في تسجيل الدخول",
  ABSENT: "غياب",
};

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
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);

  const [ordersCount, setOrdersCount] = useState("");
  const [tips, setTips] = useState("");
  const [notes, setNotes] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [workStatus, setWorkStatus] = useState<WorkStatus>("WORKED");
  const [operatedAsDriverId, setOperatedAsDriverId] = useState("");

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setFetchError(null);

    Promise.all([
      fetch(`/api/delivery/daily-orders/${orderId}`).then((r) => r.json()),
      fetch(`/api/delivery/drivers?companyId=${companyId}&includeInactive=true`).then((r) => r.json()),
    ])
      .then(([orderPayload, driversPayload]) => {
        if (!orderPayload.success) throw new Error(orderPayload.error ?? "فشل في تحميل البيانات");
        const currentOrder = orderPayload.data as Order;
        setOrder(currentOrder);
        setOrdersCount(String(currentOrder.ordersCount ?? 0));
        setTips(currentOrder.tips != null ? String(Number(currentOrder.tips)) : "");
        setNotes(currentOrder.notes ?? "");
        setWalletAmount(currentOrder.walletAmount != null ? String(currentOrder.walletAmount) : "");
        setWorkStatus(currentOrder.workStatus ?? "WORKED");
        setOperatedAsDriverId(currentOrder.operatedAsDriverId ?? "");

        if (driversPayload.success) {
          setDriverOptions(driversPayload.data as DriverOption[]);
        }
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : "فشل في تحميل البيانات"))
      .finally(() => setLoading(false));
  }, [companyId, orderId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/delivery/daily-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordersCount: Number(ordersCount),
          tips: tips ? Number(tips) : null,
          notes: notes || null,
          walletAmount: walletAmount ? Number(walletAmount) : null,
          workStatus,
          operatedAsDriverId: operatedAsDriverId || null,
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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">جارٍ تحميل البيانات...</span>
      </div>
    );
  }

  if (fetchError || !order) {
    return (
      <div className="page-container max-w-lg">
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-base font-medium text-red-600">{fetchError ?? "لم يتم العثور على السجل"}</p>
          <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
            العودة للطلبات اليومية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-card px-6 py-4">
        <h1 className="text-lg font-bold">تعديل تسجيل يومي</h1>
        <p className="text-sm text-muted-foreground">
          {order.driver.employee.nameAr} - {order.contract.nameAr} - {new Date(order.date).toLocaleDateString("ar-KW")}
        </p>
      </div>

      <div className="page-container max-w-lg space-y-6">
        <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight size={14} />
          العودة للطلبات اليومية
        </Link>

        {saveError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}

        <form onSubmit={handleSubmit} className="section-card space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">الحالة</label>
            <select value={workStatus} onChange={(event) => setWorkStatus(event.target.value as WorkStatus)} className="input-field w-full">
              {(Object.keys(WORK_STATUS_LABELS) as WorkStatus[]).map((status) => (
                <option key={status} value={status}>{WORK_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">عمل باسم</label>
            <select value={operatedAsDriverId} onChange={(event) => setOperatedAsDriverId(event.target.value)} className="input-field w-full">
              <option value="">باسمه</option>
              {driverOptions
                .filter((driver) => driver.id !== order.driverId)
                .map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.employee.nameAr}
                  {!driver.employee.isActive ? " (غير نشط)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              عدد الطلبات <span className="text-red-500">*</span>
            </label>
            <input type="number" min="0" required value={ordersCount} onChange={(event) => setOrdersCount(event.target.value)} className="input-field w-full" dir="ltr" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">إكراميات (د.ك)</label>
            <input type="number" min="0" step="0.001" value={tips} onChange={(event) => setTips(event.target.value)} className="input-field w-full" dir="ltr" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">تحصيل اليوم (د.ك)</label>
            <input type="number" min="0" step="0.001" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} className="input-field w-full" dir="ltr" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">ملاحظات</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="input-field w-full" rows={3} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href={`/dashboard/companies/${companyId}/delivery/daily-orders`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              إلغاء
            </Link>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
