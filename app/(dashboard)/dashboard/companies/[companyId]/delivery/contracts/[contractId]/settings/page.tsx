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
  const ar = {
    title: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0648\u0627\u0644\u0623\u0645\u0627\u0643\u0646",
    subtitle: "\u0623\u0633\u0639\u0627\u0631 \u0645\u0631\u062c\u0639\u064a\u0629 \u0644\u0643\u0644 \u0645\u0637\u0639\u0645 + \u0645\u0643\u0627\u0646 (\u0644\u0627 \u062a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a)",
    back: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0639\u0642\u0648\u062f",
    report: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0651\u0644\u0629",
    restaurants: "\u0627\u0644\u0645\u0637\u0627\u0639\u0645",
    restaurantName: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0637\u0639\u0645",
    add: "\u0625\u0636\u0627\u0641\u0629",
    noRestaurants: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0637\u0627\u0639\u0645",
    locations: "\u0627\u0644\u0623\u0645\u0627\u0643\u0646",
    locationName: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0643\u0627\u0646",
    noLocations: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0645\u0627\u0643\u0646",
    priceMatrix: "\u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 (\u0645\u0637\u0639\u0645 \u00d7 \u0645\u0643\u0627\u0646)",
    matrixHelp: "\u062d\u062f\u0651\u062f \u0633\u0639\u0631 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0644\u0643\u0644 \u0645\u0637\u0639\u0645 + \u0645\u0643\u0627\u0646. \u0641\u0627\u0631\u063a = \u0628\u062f\u0648\u0646 \u0633\u0639\u0631.",
    loading: "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...",
    addFirst: "\u0623\u0636\u0641 \u0645\u0637\u0639\u0645\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0648\u0645\u0643\u0627\u0646\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0623\u0648\u0644\u064b\u0627.",
    matrixHead: "\u0627\u0644\u0645\u0637\u0639\u0645 \\ \u0627\u0644\u0645\u0643\u0627\u0646",
    autoSave: "\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u062a\u064f\u062d\u0641\u0638 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0639\u0646\u062f \u0627\u0644\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u062e\u0627\u0646\u0629.",
  };

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
    if (!payload.success) {
      setError(payload.error);
      return;
    }
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
    if (!payload.success) {
      setError(payload.error);
      return;
    }
    await load();
  }

  const priceOf = (restaurantId: string, locationId: string) =>
    prices.find((price) => price.restaurantId === restaurantId && price.locationId === locationId)?.price ?? "";

  async function savePrice(restaurantId: string, locationId: string, value: string) {
    const price = value === "" ? 0 : Number(value);
    setError("");
    const res = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, locationId, price }),
    });
    const payload = await res.json();
    if (!payload.success) {
      setError(payload.error);
      return;
    }

    setPrices((prev) => {
      const others = prev.filter((item) => !(item.restaurantId === restaurantId && item.locationId === locationId));
      return price > 0 ? [...others, { restaurantId, locationId, price }] : others;
    });
  }

  return (
    <div>
      <Header
        title={en ? "Restaurants & locations pricing" : ar.title}
        subtitle={en ? "Reference pricing per restaurant + location (does not affect accounting)" : ar.subtitle}
        companyId={companyId}
      />
      <div className="page-container max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/delivery/contracts`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight size={16} /> {en ? "Back to contracts" : ar.back}
          </Link>
          <Link
            href={`/dashboard/companies/${companyId}/delivery/deliveries-report?contractId=${contractId}`}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {en ? "Recorded deliveries report" : ar.report}
          </Link>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="section-card space-y-3">
            <h3 className="text-sm font-bold">{en ? "Restaurants" : ar.restaurants}</h3>
            <div className="flex gap-2">
              <input
                value={newRestaurant}
                onChange={(event) => setNewRestaurant(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addItem("restaurant", newRestaurant);
                }}
                placeholder={en ? "Restaurant name" : ar.restaurantName}
                className="input-field flex-1 text-sm"
              />
              <button
                onClick={() => addItem("restaurant", newRestaurant)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={15} /> {en ? "Add" : ar.add}
              </button>
            </div>
            <div className="space-y-1">
              {restaurants.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en ? "No restaurants yet" : ar.noRestaurants}</p>
              ) : restaurants.map((restaurant) => (
                <div key={restaurant.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span>{restaurant.nameAr}</span>
                  <button
                    onClick={() => deleteItem("restaurant", restaurant.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card space-y-3">
            <h3 className="text-sm font-bold">{en ? "Locations" : ar.locations}</h3>
            <div className="flex gap-2">
              <input
                value={newLocation}
                onChange={(event) => setNewLocation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addItem("location", newLocation);
                }}
                placeholder={en ? "Location name" : ar.locationName}
                className="input-field flex-1 text-sm"
              />
              <button
                onClick={() => addItem("location", newLocation)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <Plus size={15} /> {en ? "Add" : ar.add}
              </button>
            </div>
            <div className="space-y-1">
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en ? "No locations yet" : ar.noLocations}</p>
              ) : locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span>{location.nameAr}</span>
                  <button
                    onClick={() => deleteItem("location", location.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section-card space-y-3">
          <h3 className="text-sm font-bold">{en ? "Price matrix (restaurant × location)" : ar.priceMatrix}</h3>
          <p className="text-xs text-muted-foreground">
            {en ? "Set the delivery price for each restaurant + location. Empty = no price." : ar.matrixHelp}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{en ? "Loading..." : ar.loading}</p>
          ) : restaurants.length === 0 || locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{en ? "Add at least one restaurant and one location first." : ar.addFirst}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-start text-muted-foreground">{en ? "Restaurant \\ Location" : ar.matrixHead}</th>
                    {locations.map((location) => (
                      <th key={location.id} className="p-2 text-center font-medium text-muted-foreground">
                        {location.nameAr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {restaurants.map((restaurant) => (
                    <tr key={restaurant.id}>
                      <td className="p-2 font-medium">{restaurant.nameAr}</td>
                      {locations.map((location) => (
                        <td key={location.id} className="p-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            defaultValue={priceOf(restaurant.id, location.id)}
                            onBlur={(event) => savePrice(restaurant.id, location.id, event.target.value)}
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
          <p className="text-[11px] text-muted-foreground">{en ? "Prices save automatically when you leave the cell." : ar.autoSave}</p>
        </div>
      </div>
    </div>
  );
}
