"use client";

import { LayoutTemplate } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useUiStyle } from "@/components/providers/ui-style-provider";
import { cn } from "@/lib/utils";

/** Compact toggle, same look as LanguageSwitcher. */
export function UiStyleSwitcher({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  const { isModern, toggle } = useUiStyle();
  const { t } = useLocale();
  const label = isModern ? t("uiStyle.toClassic") : t("uiStyle.toModern");

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "ui-style-switcher inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      aria-label={t("uiStyle.switcherLabel")}
      title={label}
    >
      <LayoutTemplate size={14} />
      {showLabel && <span>{isModern ? t("uiStyle.classic") : t("uiStyle.modern")}</span>}
    </button>
  );
}

/** Settings card with the two choices side by side. */
export function UiStyleSettingsCard() {
  const { uiStyle, setUiStyle } = useUiStyle();
  const { t } = useLocale();
  const options = [
    { value: "classic" as const, label: t("uiStyle.classic") },
    { value: "modern" as const, label: t("uiStyle.modern") },
  ];

  return (
    <section className="section-card ui-style-settings">
      <div className="mb-4">
        <h2 className="text-base font-bold">{t("uiStyle.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("uiStyle.description")}</p>
      </div>
      <div role="radiogroup" aria-label={t("uiStyle.title")} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = uiStyle === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setUiStyle(option.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-14 w-20 shrink-0 gap-1 overflow-hidden rounded-lg border p-1",
                  option.value === "modern" ? "bg-[#F4F6FA]" : "bg-muted",
                )}
              >
                <span className={cn("w-4 rounded", option.value === "modern" ? "rounded-md bg-[#0F172A]" : "bg-slate-700")} />
                <span className="flex flex-1 flex-col gap-1">
                  <span className={cn("h-3 bg-white", option.value === "modern" ? "rounded-md border border-[#E4E8F0]" : "rounded-sm border")} />
                  <span className={cn("flex-1 bg-white", option.value === "modern" ? "rounded-md border border-[#E4E8F0]" : "rounded-sm border")} />
                </span>
              </span>
              <span className="text-sm font-bold">{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
