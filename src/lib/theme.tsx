"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const KEY = "nobino_theme";
const DARK_CLASS = "dark";

interface ThemeCtx {
  mode: ThemeMode;
  dark: boolean;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  dark: false,
  setMode: () => {},
  toggle: () => {},
});

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

function resolveDark(mode: ThemeMode) {
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const next = resolveDark(mode);
      setDark(next);
      const root = document.documentElement;
      root.classList.toggle(DARK_CLASS, next);
      root.dataset.theme = next ? "dark" : "light";
    };
    update();

    if (mode !== "system") return;
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(dark ? "light" : "dark");
  }, [dark, setMode]);

  return <Ctx.Provider value={{ mode, dark, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}