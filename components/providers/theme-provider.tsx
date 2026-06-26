"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  buildThemeVars,
  applyThemeVars,
  clearThemeVars,
  type ThemeColors,
  type StoredTheme,
} from "@/lib/theme";

interface ThemeCtx {
  colors: ThemeColors;
  isCustom: boolean;
  setColors: (colors: ThemeColors) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColorsState] = useState<ThemeColors>(DEFAULT_THEME);
  const [isCustom, setIsCustom] = useState(false);

  // عند التحميل: طبّق الثيم المحفوظ (السكربت في <head> طبّقه قبل الرسم، وهنا نزامن الحالة)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const t = JSON.parse(raw) as StoredTheme;
        if (t?.colors) {
          setColorsState(t.colors);
          setIsCustom(true);
          applyThemeVars(t.vars ?? buildThemeVars(t.colors));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  function setColors(next: ThemeColors) {
    const vars = buildThemeVars(next);
    applyThemeVars(vars);
    setColorsState(next);
    setIsCustom(true);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ colors: next, vars } satisfies StoredTheme));
    } catch {
      /* ignore */
    }
  }

  function reset() {
    clearThemeVars();
    setColorsState(DEFAULT_THEME);
    setIsCustom(false);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return <ThemeContext.Provider value={{ colors, isCustom, setColors, reset }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
