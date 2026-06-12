"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface Item {
  id: string;
  nameAr: string;
}
interface Price {
  restaurantId: string;
  locationId: string;
  price: number;
}
interface DriverOpt {
  id: string;
  name: string;
}
interface Row {
  restaurantId: string;
  locationId: string;
}

/**
 * تسجيل توصيلات نظام المطاعم والأماكن (لعقود مثل RoPops) — مرجعي فقط، لا يؤثر على الحسابات.
 * لكل سائق/يوم: صفوف توصيلات (مطعم + مكان)، السعر يظهر تلقائياً من مصفوفة أسعار العقد.
 */
export function LocationOrderEntry({
  companyId,
  contractId,
  date,
  drivers,
}: {
  companyId: string;
  contractId: string;
  date: string;
  drivers: DriverOpt[];
}) {
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";

  const [restaurants, setRestaurants] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Item[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [driverId, setDriverId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/delivery/contracts/${contractId}/pricing`)
      .then((r) => r.json())
      .then((p) => {
        if (p.success) {
          setRestaurants(p.data.restaurants);
          setLocations(p.data.locations);
          setPrices(p.data.prices);
        }
        setLoading(false);
      });
  }, [contractId]);

  const loadDriverDeliveries = useCallback(
    async (dId: string) => {
      if (!dId) {
        setRows([]);
        return;
      }
      const res = await fetch(`/api/delivery/order-deliveries?contractId=${contractId}&driverId=${dId}&date=${date}`);
      const p = await res.json();
      if (p.success) {
        setRows(p.data.map((d: { restaurantId: string; locationId: string }) => ({ restaurantId: d.restaurantId, locationId: d.locationId })));
      }
    },
    [contractId, date],
  );

  useEffect(() => {
    loadDriverDeliveries(driverId);
    setMsg("");
  }, [driverId, date, loadDriverDeliveries]);

  const priceOf = (rId: string, lId: string) => prices.find((p) => p.restaurantId === rId && p.locationId === lId)?.price ?? 0;
  const total = rows.reduce((sum, r) => sum + (r.restaurantId && r.locationId ? priceOf(r.restaurantId, r.locationId) : 0), 0);

  function addRow() {
    setRows((prev) => [...prev, { restaurantId: "", locationId: "" }]);
  }
  function updateRow(index: number, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!driverId) {
      setMsg(en ? "Select a driver first" : "اختر سائقاً أولاً");
      return;
    }
    const valid = rows.filter((r) => r.restaurantId && r.locationId);
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/delivery/order-deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          contractId,
          driverId,
          date,
          deliveries: valid.map((r) => ({ restaurantId: r.restaurantId, locationId: r.locationId, price: priceOf(r.restaurantId, r.locationId) })),
        }),
      });
      const p = await res.json();
      if (!p.success) {
        setMsg(p.error ?? (en ? "Failed" : "فشل الحفظ"));
        return;
      }
      setMsg(en ? `Saved ${p.saved} deliveries for this driver/day.` : `تم حفظ ${p.saved} توصيلة لهذا السائق/اليوم.`);
    } finally {
      setSaving(false);
    }
  }

  const noSettings = !loading && (restaurants.length === 0 || locations.length === 0);

  return (
    <div className="section-card space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {en ? "Deliveries (restaurants & locations)" : "التوصيلات (مطاعم وأماكن)"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {en ? "Reference only — does not affect accounting or wallets." : "مرجعي فقط — لا يؤثر على الحسابات أو المحافظ."}
        </p>
      </div>

      {noSettings ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {en
            ? "Add restaurants, locations and prices in the contract settings first."
            : "أضف المطاعم والأماكن والأسعار من إعدادات العقد أولاً."}
        </p>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{en ? "Driver" : "السائق"}</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input-field w-full sm:w-80">
              <option value="">{en ? "Choose driver..." : "اختر السائق..."}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {driverId && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 text-start font-medium text-muted-foreground">#</th>
                      <th className="px-2 py-2 text-start font-medium text-muted-foreground">{en ? "Restaurant" : "المطعم"}</th>
                      <th className="px-2 py-2 text-start font-medium text-muted-foreground">{en ? "Location" : "المكان"}</th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">{en ? "Price" : "السعر"}</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          {en ? "No deliveries. Add a row." : "لا توجد توصيلات. أضف سطراً."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, index) => {
                        const price = row.restaurantId && row.locationId ? priceOf(row.restaurantId, row.locationId) : null;
                        const noPrice = row.restaurantId && row.locationId && price === 0;
                        return (
                          <tr key={index} className="hover:bg-muted/20">
                            <td className="px-2 py-1.5 text-muted-foreground">{index + 1}</td>
                            <td className="px-2 py-1.5">
                              <select value={row.restaurantId} onChange={(e) => updateRow(index, "restaurantId", e.target.value)} className="input-field w-44">
                                <option value="">{en ? "Restaurant..." : "المطعم..."}</option>
                                {restaurants.map((r) => (
                                  <option key={r.id} value={r.id}>{r.nameAr}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={row.locationId} onChange={(e) => updateRow(index, "locationId", e.target.value)} className="input-field w-44">
                                <option value="">{en ? "Location..." : "المكان..."}</option>
                                {locations.map((l) => (
                                  <option key={l.id} value={l.id}>{l.nameAr}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-center font-medium">
                              {price === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : noPrice ? (
                                <span className="text-xs text-amber-600">{en ? "no price set" : "بدون سعر"}</span>
                              ) : (
                                <span className="number text-blue-600">{price.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button type="button" onClick={() => removeRow(index)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 font-bold">
                      <td colSpan={3} className="px-2 py-2 text-start">{en ? "Total" : "الإجمالي"}</td>
                      <td className="number px-2 py-2 text-center text-blue-600">{total.toLocaleString(numberLocale, { minimumFractionDigits: 3 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={addRow} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                  <Plus size={15} /> {en ? "Add delivery" : "إضافة توصيلة"}
                </button>
                <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Save size={15} /> {saving ? (en ? "Saving..." : "جارٍ الحفظ...") : en ? "Save deliveries" : "حفظ التوصيلات"}
                </button>
                {msg && <span className="text-sm text-emerald-700">{msg}</span>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
