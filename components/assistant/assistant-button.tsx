"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, Bot, ChevronLeft, CircleCheck, Info, RefreshCw, X } from "lucide-react";
import type { AssistantArea, AssistantTask } from "@/lib/assistant/tasks";

const AREAS: Array<{ key: AssistantArea | "all"; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "accounting", label: "المحاسبة" },
  { key: "hr", label: "الموارد البشرية" },
  { key: "operations", label: "التشغيل" },
  { key: "admin", label: "الشؤون الإدارية" },
  { key: "personal", label: "تذكيراتي" },
];

const SEVERITY = {
  crit: { box: "bg-[#FEF1EC] text-[#B42318]", icon: AlertTriangle },
  warn: { box: "bg-[#FFF6E0] text-[#8A5A00]", icon: BellRing },
  info: { box: "bg-[#EAF3FF] text-[#1D5FA8]", icon: Info },
} as const;

const REFRESH_MS = 5 * 60 * 1000;

export function AssistantButton({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const companyId = useMemo(() => pathname.match(/^\/dashboard\/companies\/([^/]+)/)?.[1] ?? null, [pathname]);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"company" | "all">("company");
  const [area, setArea] = useState<AssistantArea | "all">("all");
  const [tasks, setTasks] = useState<AssistantTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const effectiveCompanyId = scope === "company" ? companyId : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = effectiveCompanyId ? `?companyId=${encodeURIComponent(effectiveCompanyId)}` : "";
      const response = await fetch(`/api/assistant/tasks${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "error");
      setTasks(payload.data.tasks as AssistantTask[]);
    } catch {
      setError("تعذر تحميل المهام. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && !(target as HTMLElement).closest?.("[data-assistant-trigger]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  const urgent = tasks.filter((task) => task.severity !== "info").length;
  const visible = area === "all" ? tasks : tasks.filter((task) => task.area === area);
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => counts.set(task.area, (counts.get(task.area) ?? 0) + 1));
    return counts;
  }, [tasks]);

  const panel = open && mounted ? createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="مساعدي"
      dir="rtl"
      className="assistant-panel fixed inset-x-3 bottom-3 top-16 z-[60] flex flex-col overflow-hidden rounded-[22px] border border-border bg-card text-foreground shadow-[0_24px_60px_rgba(2,6,23,0.25)] md:inset-x-auto md:bottom-auto md:top-20 md:max-h-[78vh] md:w-[420px] ltr:md:left-[calc(16rem+40px)] rtl:md:right-[calc(16rem+40px)]"
    >
      <div className="flex items-center gap-3 bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] px-4 py-3.5 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/20"><Bot size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight">مساعدي</p>
          <p className="text-xs text-white/85">{loading ? "جارٍ التحديث…" : tasks.length ? `${tasks.length} مهمة · ${urgent} محتاجة اهتمام` : "مفيش مهام معلّقة"}</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="تحديث" className="flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-white/15">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-white/15">
          <X size={18} />
        </button>
      </div>

      {companyId ? (
        <div className="grid grid-cols-2 gap-1 border-b border-border p-2">
          {(["company", "all"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
              className={scope === value ? "min-h-9 rounded-[10px] bg-foreground text-sm font-bold text-background" : "min-h-9 rounded-[10px] text-sm text-muted-foreground hover:bg-muted"}>
              {value === "company" ? "الشركة الحالية" : "كل شركاتي"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
        {AREAS.filter((item) => item.key === "all" || areaCounts.has(item.key)).map((item) => (
          <button key={item.key} type="button" onClick={() => setArea(item.key)} aria-pressed={area === item.key}
            className={area === item.key ? "shrink-0 rounded-full bg-[#3B5BDB] px-3 py-1.5 text-xs font-bold text-white" : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"}>
            {item.label}{item.key !== "all" ? ` (${areaCounts.get(item.key)})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error ? <p className="p-4 text-center text-sm text-[#B42318]">{error}</p> : null}
        {!error && !loading && visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <CircleCheck size={28} className="text-[#067647]" />
            مفيش مهام معلّقة هنا. شغل ممتاز 👌
          </div>
        ) : null}
        {visible.map((task) => {
          const tone = SEVERITY[task.severity];
          const Icon = tone.icon;
          return (
            <Link key={task.id} href={task.href} onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-3 rounded-[14px] p-2.5 hover:bg-muted">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${tone.box}`}><Icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{task.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{task.detail}{task.companyName && (scope === "all" || !companyId) ? ` · ${task.companyName}` : ""}</span>
              </span>
              <ChevronLeft size={16} className="shrink-0 text-muted-foreground ltr:rotate-180" />
            </Link>
          );
        })}
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">المهام بتظهر حسب صلاحياتك، وبتتحدّث كل 5 دقايق.</p>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        data-assistant-trigger
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="assistant-trigger relative flex w-full items-center gap-3 rounded-xl bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20"><Bot size={16} /></span>
        <span className="flex-1 text-start">مساعدي</span>
        {urgent > 0 ? <span className="min-w-6 rounded-full bg-white px-1.5 py-0.5 text-center text-xs font-extrabold text-[#3B5BDB]">{urgent > 99 ? "99+" : urgent}</span> : null}
      </button>
      {panel}
    </>
  );
}
