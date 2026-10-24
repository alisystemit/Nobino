"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const saved = localStorage.getItem("nobino_theme") as Theme | null;
      if (saved === "light" || saved === "dark") initial = saved;
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) initial = "dark";
    } catch {}
    applyTheme(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("nobino_theme", t);
    } catch {}
  }

  return <Ctx.Provider value={{ theme, toggle: () => applyTheme(theme === "light" ? "dark" : "light") }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:scale-105"
      aria-label="تغییر تم"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
