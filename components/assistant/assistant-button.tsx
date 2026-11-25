"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, ChevronLeft, CircleCheck, Info, Pencil, RefreshCw, X } from "lucide-react";
import type { AssistantArea, AssistantTask } from "@/lib/assistant/tasks";
import { BlinkingBot } from "@/components/assistant/blinking-bot";

const AREAS: Array<{ key: AssistantArea | "all"; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "accounting", label: "المحاسبة" },
  { key: "hr", label: "الموارد البشرية" },
  { key: "operations", label: "التشغيل" },
  { key: "admin", label: "الشؤون الإدارية" },
  { key: "data", label: "بيانات ناقصة" },
  { key: "personal", label: "تذكيراتي" },
];

const SEVERITY = {
  crit: { box: "bg-[#FEF1EC] text-[#B42318]", icon: AlertTriangle },
  warn: { box: "bg-[#FFF6E0] text-[#8A5A00]", icon: BellRing },
  info: { box: "bg-[#EAF3FF] text-[#1D5FA8]", icon: Info },
} as const;

const REFRESH_MS = 5 * 60 * 1000;
const NAME_KEY = "aras_assistant_name";

// Friendly sentence per task type (falls back to the task title).
function say(task: AssistantTask): string {
  const n = task.count;
  const kind = task.id.split(":")[0];
  const lines: Record<string, string> = {
    "je-pending": `عندك ${n} قيد يومي محتاج اعتماد وموافقة`,
    "je-approved": `عندك ${n} قيد معتمد محتاج ترحيل`,
    "je-draft": `عندك ${n} قيد لسه مسودة`,
    "res-expired": `فيه ${n} إقامة منتهية محتاجة تجديد فوراً`,
    "res-soon": `فيه ${n} إقامة هتنتهي خلال 30 يوم`,
    health: `فيه ${n} بطاقة صحية منتهية أو قربت`,
    inv: `فيه ${n} فاتورة سائقين مستنية مراجعتك`,
    dep: `فيه ${n} إيصال إيداع مستني اعتمادك`,
    lic: `فيه ${n} ترخيص قرب ينتهي أو انتهى`,
    veh: `فيه ${n} مركبة تسجيلها أو تأمينها قرب يخلص`,
    talabat: `فيه ${n} تقرير طلبات لسه متترحلش`,
    "no-civil": `فيه ${n} موظف ناقصه الرقم المدني`,
    "no-residency": `فيه ${n} موظف من غير تاريخ انتهاء إقامة`,
  };
  return lines[kind] ?? (n > 1 ? `${task.title} (${n})` : task.title);
}

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kuwait" }).format(new Date()));
  return hour < 12 ? "صباح الخير" : "مساء الخير";
}

function joinAr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join("، ")}، و${parts[parts.length - 1]}`;
}

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
  const [firstName, setFirstName] = useState("");
  const [nickname, setNickname] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [bubble, setBubble] = useState(false);
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
      if (payload.data.firstName) setFirstName(String(payload.data.firstName));
    } catch {
      setError("تعذر تحميل المهام. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    setMounted(true);
    try { setNickname(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
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
  const callName = (nickname || firstName).trim();
  const hello = `${greeting()}${callName ? ` يا ${callName}` : ""}`;
  const topLines = tasks.filter((task) => task.severity !== "info").slice(0, 3).map(say);
  const headline = topLines.length ? `${joinAr(topLines)}.` : tasks.length ? "مفيش حاجة عاجلة، بس فيه شوية حاجات للمتابعة." : "كله تمام، مفيش مهام معلّقة 👌";

  // Once per day per browser: a short greeting bubble when there is something urgent.
  useEffect(() => {
    if (!mounted || urgent === 0 || open) return;
    let key = "";
    try {
      key = `aras_assistant_bubble_${new Date().toISOString().slice(0, 10)}`;
      if (sessionStorage.getItem(key)) return;
    } catch { return; }
    const show = setTimeout(() => { setBubble(true); try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }, 1200);
    return () => clearTimeout(show);
  }, [mounted, urgent, open]);
  useEffect(() => {
    if (!bubble) return;
    const hide = setTimeout(() => setBubble(false), 25000);
    return () => clearTimeout(hide);
  }, [bubble]);

  function saveNickname(value: string) {
    const clean = value.trim().slice(0, 30);
    setNickname(clean);
    try { if (clean) localStorage.setItem(NAME_KEY, clean); else localStorage.removeItem(NAME_KEY); } catch { /* ignore */ }
    setEditingName(false);
  }
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
      className="assistant-panel fixed inset-x-3 bottom-3 top-16 z-[60] flex flex-col overflow-hidden rounded-[22px] border border-border bg-card text-foreground shadow-[0_24px_60px_rgba(2,6,23,0.25)] md:inset-x-auto md:bottom-auto md:top-20 md:max-h-[78vh] md:w-[420px]"
    >
      <div className="flex shrink-0 items-center gap-3 bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] px-4 py-3.5 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/20"><BlinkingBot size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight">{hello} 👋</p>
          <p className="text-xs text-white/85">{loading ? "جارٍ التحديث…" : tasks.length ? `${tasks.length} مهمة · ${urgent} محتاجة اهتمام` : "مفيش مهام معلّقة"}</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="تحديث" className="flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-white/15">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-white/15">
          <X size={18} />
        </button>
      </div>

      {tasks.length > 0 ? (
        <p className="shrink-0 border-b border-border bg-[#F5F7FF] px-4 py-3 text-sm leading-relaxed text-[#1E2A55] dark:bg-muted dark:text-foreground">{headline}</p>
      ) : null}

      {companyId ? (
        <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border p-2">
          {(["company", "all"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value}
              className={scope === value ? "min-h-9 rounded-[10px] bg-foreground text-sm font-bold text-background" : "min-h-9 rounded-[10px] text-sm text-muted-foreground hover:bg-muted"}>
              {value === "company" ? "الشركة الحالية" : "كل شركاتي"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
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
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        {editingName ? (
          <form className="flex flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); saveNickname(String(new FormData(event.currentTarget).get("nick") ?? "")); }}>
            <span>ناديني بـ</span>
            <input name="nick" defaultValue={callName} maxLength={30} autoFocus className="h-8 flex-1 rounded-[8px] border border-border bg-background px-2 text-xs text-foreground" />
            <button type="submit" className="rounded-[8px] bg-[#3B5BDB] px-2.5 py-1.5 text-xs font-bold text-white">حفظ</button>
          </form>
        ) : (
          <>
            <span className="flex-1">المهام حسب صلاحياتك، وبتتحدّث كل 5 دقايق.</span>
            <button type="button" onClick={() => setEditingName(true)} className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 hover:bg-muted">
              <Pencil size={12} /> {callName ? `ناديني: ${callName}` : "اسمي"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  const bubbleEl = bubble && mounted && !open ? createPortal(
    <div role="status" dir="rtl" className="assistant-bubble fixed inset-x-3 bottom-4 z-[60] rounded-[20px] border border-[#C7D2FE] bg-card p-4 text-foreground shadow-[0_18px_48px_rgba(59,91,219,0.25)] md:inset-x-auto md:bottom-auto md:top-20 md:w-[360px]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] text-white"><BlinkingBot size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">{hello} 👋</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{headline}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setBubble(false); setOpen(true); }} className="rounded-[10px] bg-[#3B5BDB] px-3 py-2 text-xs font-bold text-white">عرض المهام</button>
            <button type="button" onClick={() => setBubble(false)} className="rounded-[10px] border border-border px-3 py-2 text-xs">بعدين</button>
          </div>
        </div>
        <button type="button" onClick={() => setBubble(false)} aria-label="إغلاق" className="text-muted-foreground"><X size={16} /></button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <style>{`@media (min-width: 768px) { .assistant-panel, .assistant-bubble { inset-inline-start: calc(16rem + 40px); inset-inline-end: auto; } }`}</style>
      <button
        type="button"
        data-assistant-trigger
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="assistant-trigger relative flex w-full items-center gap-3 rounded-xl bg-gradient-to-l from-[#3B5BDB] to-[#5B7BF0] px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20"><BlinkingBot size={18} /></span>
        <span className="flex-1 text-start">مساعدي</span>
        {urgent > 0 ? <span className="min-w-6 rounded-full bg-white px-1.5 py-0.5 text-center text-xs font-extrabold text-[#3B5BDB]">{urgent > 99 ? "99+" : urgent}</span> : null}
      </button>
      {panel}
      {bubbleEl}
    </>
  );
}
