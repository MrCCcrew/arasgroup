"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_UI_STYLE, writeUiStyleCookie, type UiStyle } from "@/lib/ui-style-shared";

interface UiStyleContextValue {
  uiStyle: UiStyle;
  isModern: boolean;
  setUiStyle: (style: UiStyle) => void;
  toggle: () => void;
}

const UiStyleContext = createContext<UiStyleContextValue | null>(null);

export function UiStyleProvider({ children, initialStyle }: { children: React.ReactNode; initialStyle: UiStyle }) {
  const router = useRouter();
  const [uiStyle, setState] = useState<UiStyle>(initialStyle);

  const setUiStyle = useCallback(
    (style: UiStyle) => {
      if (style === uiStyle) return;
      writeUiStyleCookie(style);
      document.documentElement.dataset.ui = style;
      setState(style);
      // Server components that read getUiStyle() re-render with the new value.
      router.refresh();
    },
    [router, uiStyle],
  );

  const value = useMemo<UiStyleContextValue>(
    () => ({
      uiStyle,
      isModern: uiStyle === "modern",
      setUiStyle,
      toggle: () => setUiStyle(uiStyle === "modern" ? "classic" : "modern"),
    }),
    [setUiStyle, uiStyle],
  );

  return <UiStyleContext.Provider value={value}>{children}</UiStyleContext.Provider>;
}

export function useUiStyle(): UiStyleContextValue {
  return (
    useContext(UiStyleContext) ?? {
      uiStyle: DEFAULT_UI_STYLE,
      isModern: DEFAULT_UI_STYLE === "modern",
      setUiStyle: () => undefined,
      toggle: () => undefined,
    }
  );
}
