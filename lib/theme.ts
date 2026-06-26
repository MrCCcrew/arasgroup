// نظام ثيم لكل مستخدم (محلي على المتصفح). الألوان CSS variables بصيغة HSL triplet
// "H S% L%" يستخدمها Tailwind عبر hsl(var(--x)). تغيير الجذر يطبّق على النظام كله.

export const THEME_STORAGE_KEY = "aras-theme";

export interface ThemeColors {
  sidebar: string; // hex — لون الشريط الجانبي
  background: string; // hex — لون الواجهة (الخلفية)
  foreground: string; // hex — لون الخط
}

// الافتراضي (مطابق لقيم :root الحالية)
export const DEFAULT_THEME: ThemeColors = {
  sidebar: "#2a3344",
  background: "#f1f3f7",
  foreground: "#0b1020",
};

export const THEME_PRESETS: { name: string; nameEn: string; colors: ThemeColors }[] = [
  { name: "افتراضي", nameEn: "Default", colors: DEFAULT_THEME },
  { name: "داكن", nameEn: "Dark", colors: { sidebar: "#0f172a", background: "#1e293b", foreground: "#e2e8f0" } },
  { name: "أزرق", nameEn: "Blue", colors: { sidebar: "#1e3a8a", background: "#eff6ff", foreground: "#0f172a" } },
  { name: "أخضر", nameEn: "Green", colors: { sidebar: "#14532d", background: "#f0fdf4", foreground: "#0f1d12" } },
  { name: "بنفسجي", nameEn: "Purple", colors: { sidebar: "#3b0764", background: "#faf5ff", foreground: "#1e1033" } },
  { name: "رملي", nameEn: "Sand", colors: { sidebar: "#44403c", background: "#faf8f3", foreground: "#1c1917" } },
];

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const trip = (c: Hsl) => `${c.h} ${clamp(c.s)}% ${clamp(c.l)}%`;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const adjustL = (c: Hsl, delta: number): Hsl => ({ ...c, l: clamp(c.l + delta) });
const mixL = (a: Hsl, towardL: number, ratio: number): Hsl => ({ ...a, l: clamp(a.l + (towardL - a.l) * ratio) });

// يبني خريطة كل متغيرات الثيم من الألوان الثلاثة المختارة
export function buildThemeVars(colors: ThemeColors): Record<string, string> {
  const sb = hexToHsl(colors.sidebar);
  const bg = hexToHsl(colors.background);
  const fg = hexToHsl(colors.foreground);
  const sbLight = sb.l > 55;
  const bgLight = bg.l > 55;
  const sidebarText: Hsl = sbLight ? { h: sb.h, s: 12, l: 12 } : { h: 0, s: 0, l: 98 };

  return {
    "--sidebar-background": trip(sb),
    "--sidebar-foreground": trip(sidebarText),
    "--sidebar-accent": trip(adjustL(sb, sbLight ? -8 : 8)),
    "--sidebar-accent-foreground": trip(sidebarText),
    "--sidebar-border": trip(adjustL(sb, sbLight ? -12 : 10)),
    "--background": trip(bg),
    "--card": trip(adjustL(bg, bgLight ? 2 : 4)),
    "--popover": trip(adjustL(bg, bgLight ? 2 : 4)),
    "--muted": trip(adjustL(bg, bgLight ? -5 : 6)),
    "--accent": trip(adjustL(bg, bgLight ? -5 : 6)),
    "--border": trip(adjustL(bg, bgLight ? -12 : 12)),
    "--input": trip(adjustL(bg, bgLight ? -12 : 12)),
    "--foreground": trip(fg),
    "--card-foreground": trip(fg),
    "--popover-foreground": trip(fg),
    "--secondary-foreground": trip(fg),
    "--accent-foreground": trip(fg),
    "--muted-foreground": trip(mixL(fg, bg.l, 0.45)),
  };
}

export const THEME_VAR_KEYS = Object.keys(buildThemeVars(DEFAULT_THEME));

export interface StoredTheme {
  colors: ThemeColors;
  vars: Record<string, string>;
}

export function applyThemeVars(vars: Record<string, string>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

export function clearThemeVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const k of THEME_VAR_KEYS) root.style.removeProperty(k);
}

// سكربت يُحقن في <head> ليطبّق الثيم المحفوظ قبل الرسم (منع الوميض)
export const THEME_PREPAINT_SCRIPT = `
try {
  var t = JSON.parse(localStorage.getItem('${THEME_STORAGE_KEY}') || 'null');
  if (t && t.vars) { var r = document.documentElement; for (var k in t.vars) r.style.setProperty(k, t.vars[k]); }
} catch (e) {}
`;
