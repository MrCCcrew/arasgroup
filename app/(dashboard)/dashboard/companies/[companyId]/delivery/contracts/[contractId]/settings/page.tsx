"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";
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

export default function ContractPricingSettingsPage() {
  const { companyId, contractId } = useParams<{ companyId: string; contractId: string }>();
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";

  const [restaurants, setRestaurants] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Item[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRestaurant, setNewRestaurant] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [error, setError] = useState("");

  const base = `/api/delivery/contracts/${contractId}/pricing`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(base);
    const payload = await res.json();
    if (payload.success) {
      setRestaurants(payload.data.restaurants);
      setLocations(payload.data.locations);
      setPrices(payload.data.prices);
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem(kind: "restaurant" | "location", nameAr: string) {
    if (!nameAr.trim()) return;
    setError("");
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, nameAr: nameAr.trim() }),
    });
    const payload = await res.json();
    if (!payload.success) { setError(payload.error); return; }
    if (kind === "restaurant") setNewRestaurant("");
    else setNewLocation("");
    await load();
  }

  async function deleteItem(kind: "restaurant" | "location", id: string) {
    const res = await fetch(base, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const payload = await res.json();
    if (!payload.success) { setError(payload.error); return; }
    await load();
  }

  const priceOf = (restaurantId: string, locationId: string) =>
    prices.find((p) => p.restaurantId === restaurantId && p.locationId === locationId)?.price ?? "";

  async function savePrice(restaurantId: string, locationId: string, value: string) {
    const price = value === "" ? 0 : Number(value);
    setError("");
    const res = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, locationId, price }),
    });
    const payload = await res.json();
    if (!payload.success) { setError(payload.error); return; }
    setPrices((prev) => {
      const others = prev.filter((p) => !(p.restaurantId === restaurantId && p.locationId === locationId));
      return price > 0 ? [...others, { restaurantId, locationId, price }] : others;
    });
  }

  return (
    <div>
      <Header
        title={en ? "Restaurants & locations pricing" : "إعدادات المطاعم والأماكن"}
        subtitle={en ? "Reference pricing per restaurant + location (does not affect accounting)" : "أسعار مرجعية لكل مطعم + مكان (لا تؤثر على الحسابات)"}
        companyId={companyId}
      />
      <div className="page-container max-w-5xl space-y-4">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/contracts`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={16} /> {en ? "Back to contracts" : "العودة للعقود"}
        </Link>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* المطاعم */}
          <div className="section-card space-y-3">
            <h3 className="text-sm font-bold">{en ? "Restaurants" : "المطاعم"}</h3>
            <div className="flex gap-2">
              <input
                value={newRestaurant}
                onChange={(e) => setNewRestaurant(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem("restaurant", newRestaurant); }}
                placeholder={en ? "Restaurant name" : "اسم المطعم"}
                className="input-field flex-1 text-sm"
              />
              <button onClick={() => addItem("restaurant", newRestaurant)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                <Plus size={15} /> {en ? "Add" : "إضافة"}
              </button>
            </div>
            <div className="space-y-1">
              {restaurants.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en ? "No restaurants yet" : "لا توجد مطاعم"}</p>
              ) : restaurants.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span>{r.nameAr}</span>
                  <button onClick={() => deleteItem("restaurant", r.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* الأماكن */}
          <div className="section-card space-y-3">
            <h3 className="text-sm font-bold">{en ? "Locations" : "الأماكن"}</h3>
            <div className="flex gap-2">
              <input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem("location", newLocation); }}
                placeholder={en ? "Location name" : "اسم المكان"}
                className="input-field flex-1 text-sm"
              />
              <button onClick={() => addItem("location", newLocation)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                <Plus size={15} /> {en ? "Add" : "إضافة"}
              </button>
            </div>
            <div className="space-y-1">
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en ? "No locations yet" : "لا توجد أماكن"}</p>
              ) : locations.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span>{l.nameAr}</span>
                  <button onClick={() => deleteItem("location", l.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* مصفوفة الأسعار */}
        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold">{en ? "Price matrix (restaurant × location)" : "مصفوفة الأسعار (مطعم × مكان)"}</h3>
          <p className="text-xs text-muted-foreground">
            {en ? "Set the delivery price for each restaurant + location. Empty = no price." : "حدّد سعر التوصيل لكل مطعم + مكان. فارغ = بدون سعر."}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{en ? "Loading..." : "جاري التحميل..."}</p>
          ) : restaurants.length === 0 || locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{en ? "Add at least one restaurant and one location first." : "أضف مطعماً واحداً ومكاناً واحداً على الأقل أولاً."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-start text-muted-foreground">{en ? "Restaurant \\ Location" : "المطعم \\ المكان"}</th>
                    {locations.map((l) => (
                      <th key={l.id} className="p-2 text-center font-medium text-muted-foreground">{l.nameAr}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {restaurants.map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 font-medium">{r.nameAr}</td>
                      {locations.map((l) => (
                        <td key={l.id} className="p-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            defaultValue={priceOf(r.id, l.id)}
                            onBlur={(e) => savePrice(r.id, l.id, e.target.value)}
                            className="input-field w-24 text-center"
                            dir="ltr"
                            placeholder="0.000"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{en ? "Prices save automatically when you leave the cell." : "الأسعار تُحفظ تلقائياً عند الخروج من الخانة."}</p>
        </div>
      </div>
    </div>
  );
}
