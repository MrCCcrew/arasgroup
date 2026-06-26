"use client";

import { Palette, RotateCcw } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { THEME_PRESETS, type ThemeColors } from "@/lib/theme";

export function ThemeSettings() {
  const { colors, setColors, reset, isCustom } = useTheme();
  const { locale } = useLocale();
  const en = locale === "en";

  const fields: { key: keyof ThemeColors; ar: string; en: string }[] = [
    { key: "sidebar", ar: "لون الشريط الجانبي", en: "Sidebar color" },
    { key: "background", ar: "لون الواجهة", en: "Interface color" },
    { key: "foreground", ar: "لون الخط", en: "Font color" },
  ];

  function update(key: keyof ThemeColors, value: string) {
    setColors({ ...colors, [key]: value });
  }

  return (
    <div className="section-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold">{en ? "Appearance" : "المظهر والألوان"}</h3>
            <p className="text-xs text-muted-foreground">
              {en ? "Choose your own colors — applied across the whole system (saved on this device)." : "اختر ألوانك الخاصة — تُطبّق على النظام كله (محفوظة على هذا الجهاز)."}
            </p>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
          <RotateCcw size={13} /> {en ? "Reset" : "استعادة الافتراضي"}
        </button>
      </div>

      {/* ألوان جاهزة */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{en ? "Presets" : "ثيمات جاهزة"}</p>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.nameEn}
              onClick={() => setColors(p.colors)}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
              title={en ? p.nameEn : p.name}
            >
              <span className="flex h-4 w-10 overflow-hidden rounded">
                <span className="h-full w-1/3" style={{ background: p.colors.sidebar }} />
                <span className="h-full w-1/3" style={{ background: p.colors.background }} />
                <span className="h-full w-1/3" style={{ background: p.colors.foreground }} />
              </span>
              {en ? p.nameEn : p.name}
            </button>
          ))}
        </div>
      </div>

      {/* اختيار الألوان يدويًا */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-medium">{en ? f.en : f.ar}</label>
            <div className="flex items-center gap-2 rounded-lg border p-1.5">
              <input
                type="color"
                value={colors[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={colors[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="input-field w-full text-xs"
                dir="ltr"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isCustom
          ? en ? "Custom theme active." : "ثيم مخصّص مُفعّل."
          : en ? "Using the default theme." : "تستخدم الثيم الافتراضي."}
      </p>
    </div>
  );
}
