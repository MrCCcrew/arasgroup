"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, X } from "lucide-react";

export interface DriverOption {
  id: string;
  name: string;
}

export interface AllocationLine {
  driverId: string;
  allocatedOrders: number;
  notes?: string | null;
}

interface Props {
  orderId: string;
  ordersCount: number;
  originalDriverName: string;
  drivers: DriverOption[];
  initial: AllocationLine[];
  en: boolean;
}

export function DistributeOrders({ orderId, ordersCount, originalDriverName, drivers, initial, en }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<AllocationLine[]>(
    initial.length > 0 ? initial.map((l) => ({ ...l })) : [{ driverId: "", allocatedOrders: ordersCount }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const t = {
    distribute: en ? "Distribute" : "توزيع",
    title: en ? "Distribute orders to the actual driver" : "توزيع الطلبات على السائق الفعلي",
    intro: en
      ? `Total orders: ${ordersCount}. Recorded under: ${originalDriverName}. Distribute them to the driver(s) who actually worked. The original record is preserved.`
      : `إجمالي الطلبات: ${ordersCount}. مسجّلة باسم: ${originalDriverName}. وزّعها على السائق/السائقين الذين عملوا فعلاً. السجل الأصلي محفوظ كما هو.`,
    driver: en ? "Driver" : "السائق",
    orders: en ? "Orders" : "الطلبات",
    chooseDriver: en ? "Select driver" : "اختر السائق",
    addLine: en ? "Add driver" : "إضافة سائق",
    remaining: en ? "Remaining" : "المتبقّي",
    mustEqual: en ? `Total distributed must equal ${ordersCount}` : `إجمالي الموزّع يجب أن يساوي ${ordersCount}`,
    pickAll: en ? "Select a driver for each line" : "اختر سائقاً لكل سطر",
    save: en ? "Save distribution" : "حفظ التوزيع",
    saving: en ? "Saving..." : "جاري الحفظ...",
    clear: en ? "Clear distribution" : "إلغاء التوزيع",
    cancel: en ? "Cancel" : "إلغاء",
    dup: en ? "Cannot repeat the same driver" : "لا يمكن تكرار نفس السائق",
  };

  const total = lines.reduce((s, l) => s + (Number(l.allocatedOrders) || 0), 0);
  const remaining = ordersCount - total;

  function update(i: number, patch: Partial<AllocationLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save(clear = false) {
    setError("");
    const payload = clear ? [] : lines.filter((l) => l.driverId && Number(l.allocatedOrders) > 0);
    if (!clear) {
      if (payload.some((l) => !l.driverId)) { setError(t.pickAll); return; }
      const ids = payload.map((l) => l.driverId);
      if (new Set(ids).size !== ids.length) { setError(t.dup); return; }
      if (payload.reduce((s, l) => s + Number(l.allocatedOrders), 0) !== ordersCount) { setError(t.mustEqual); return; }
    }
    setSaving(true);
    const res = await fetch(`/api/delivery/daily-orders/${orderId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations: payload.map((l) => ({ driverId: l.driverId, allocatedOrders: Number(l.allocatedOrders), notes: l.notes || undefined })) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setError(data.error ?? "Error"); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={t.distribute}
      >
        <Users size={13} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">{t.title}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-3 p-5">
              <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{t.intro}</p>

              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={line.driverId}
                    onChange={(e) => update(i, { driverId: e.target.value })}
                    className="input-field flex-1"
                  >
                    <option value="">{t.chooseDriver}</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={line.allocatedOrders}
                    onChange={(e) => update(i, { allocatedOrders: parseInt(e.target.value, 10) || 0 })}
                    className="input-field w-24 text-center"
                    dir="ltr"
                  />
                  {lines.length > 1 && (
                    <button onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setLines((prev) => [...prev, { driverId: "", allocatedOrders: Math.max(0, remaining) }])}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <Plus size={13} /> {t.addLine}
                </button>
                <span className={`text-xs font-medium ${remaining === 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {t.remaining}: {remaining}
                </span>
              </div>

              {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

              <div className="flex justify-between gap-2 pt-1">
                {initial.length > 0 ? (
                  <button onClick={() => save(true)} disabled={saving} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                    {t.clear}
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
                  <button onClick={() => save(false)} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {saving ? t.saving : t.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
