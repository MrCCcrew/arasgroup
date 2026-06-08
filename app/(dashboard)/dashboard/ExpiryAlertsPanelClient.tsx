"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Building2, ChevronLeft, FileText, ShieldUser, UserRound } from "lucide-react";
import type { AlertItem } from "./ExpiryAlertsPanel";

interface Props {
  alerts: AlertItem[];
  maxShown: number;
  totals: {
    danger: number;
    warning: number;
    notice: number;
  };
}

function severity(days: number): "danger" | "warning" | "notice" {
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "notice";
}

const DANGER_CLASSES = "bg-red-50/90 border-red-200 text-red-900";
const WARNING_CLASSES = "bg-orange-50/90 border-orange-200 text-orange-900";
const NOTICE_CLASSES = "bg-yellow-50/90 border-yellow-200 text-yellow-900";

const BADGE_DANGER = "bg-red-100 text-red-700 border border-red-200";
const BADGE_WARNING = "bg-orange-100 text-orange-700 border border-orange-200";
const BADGE_NOTICE = "bg-yellow-100 text-yellow-700 border border-yellow-200";

function buildMeta(item: AlertItem) {
  return [
    { icon: <Building2 size={13} />, text: `الشركة: ${item.companyName}` },
    item.linkedLicense ? { icon: <FileText size={13} />, text: `الترخيص: ${item.linkedLicense}` } : null,
    item.responsibleName ? { icon: <ShieldUser size={13} />, text: `المسؤول: ${item.responsibleName}` } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; text: string }>;
}

export function ExpiryAlertsPanelClient({ alerts, maxShown, totals }: Props) {
  const filterOptions = ["الكل", ...Array.from(new Set(alerts.map((item) => item.expiryLabel)))];
  const [activeFilter, setActiveFilter] = useState("الكل");

  const filteredAlerts = activeFilter === "الكل" ? alerts : alerts.filter((item) => item.expiryLabel === activeFilter);
  const shown = filteredAlerts.slice(0, maxShown);
  const remaining = filteredAlerts.length - shown.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="border-b border-red-200 bg-gradient-to-l from-red-50 to-orange-50 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-4 w-4 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
            </span>
            <h2 className="text-base font-bold text-red-800">تنبيهات الانتهاء</h2>
            <div className="flex items-center gap-1.5">
              {totals.danger > 0 && (
                <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  {totals.danger} حرجة
                </span>
              )}
              {totals.warning > 0 && (
                <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                  {totals.warning} تحذير
                </span>
              )}
              {totals.notice > 0 && (
                <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                  {totals.notice} تنبيه
                </span>
              )}
            </div>
          </div>
          <AlertTriangle size={18} className="shrink-0 text-red-400" />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-red-700">فلترة حسب نوع تاريخ الانتهاء</p>
            <span className="text-xs text-red-700/80">{filteredAlerts.length} نتيجة</span>
          </div>

          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            className="input-field w-full border-red-200 bg-white text-sm"
          >
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = activeFilter === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setActiveFilter(option)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    isActive
                      ? "border-red-300 bg-red-100 font-semibold text-red-700"
                      : "border-red-100 bg-white text-red-700/80 hover:bg-red-50"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-red-100/80">
        {shown.map((item) => {
          const sev = severity(item.daysLeft);
          const rowCls = sev === "danger" ? DANGER_CLASSES : sev === "warning" ? WARNING_CLASSES : NOTICE_CLASSES;
          const badgeCls = sev === "danger" ? BADGE_DANGER : sev === "warning" ? BADGE_WARNING : BADGE_NOTICE;
          const dayLabel =
            item.daysLeft === 0 ? "ينتهي اليوم" : item.daysLeft < 0 ? `انتهى منذ ${Math.abs(item.daysLeft)} يوم` : `${item.daysLeft} يوم`;
          const meta = buildMeta(item);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center justify-between gap-4 px-5 py-3 transition-opacity hover:opacity-85 ${rowCls}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-base text-current">
                    {item.category === "license" ? <FileText size={18} /> : item.category === "employee" ? <UserRound size={18} /> : <Building2 size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-current/15 bg-white/70 px-2 py-0.5 text-xs font-bold">
                        {item.expiryLabel}
                      </span>
                      <span className="truncate text-sm font-semibold">{item.entityLabel}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-current/80">
                      {meta.map((entry) => (
                        <span key={entry.text} className="inline-flex items-center gap-1.5">
                          {entry.icon}
                          <span>{entry.text}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${badgeCls}`}>
                  {dayLabel}
                </span>
                <ChevronLeft size={14} className="opacity-50" />
              </div>
            </Link>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات لهذا النوع حاليًا</div>
        )}

        {remaining > 0 && (
          <div className="bg-gray-50 px-5 py-3 text-center text-sm text-muted-foreground">
            و <span className="font-bold text-foreground">{remaining}</span> بندًا آخر قريب الانتهاء
          </div>
        )}
      </div>
    </div>
  );
}
