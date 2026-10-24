"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LangSwitch, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

export default function GlobalHeader() {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // اگر مشتری وارد شده باشد، پکیج‌ها را در منو نشان نده
  useEffect(() => {
    (async () => {
      try {
        const me = await (await fetch("/api/auth/me")).json();
        if (me.user?.role) setRole(me.user.role);
      } catch {}
    })();
  }, []);

  const links = [
    { href: "/salons", label: t("nav.salons") },
    ...(role === "CUSTOMER" ? [] : [{ href: "/packages", label: t("nav.packages") }]),
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 dark:bg-neutral-950/85 ${
        scrolled
          ? "bg-white/90 shadow-lg shadow-black/5 backdrop-blur-xl dark:shadow-black/40"
          : "bg-white/70 backdrop-blur-xl border-b border-black/5 dark:border-white/10"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-lg text-white shadow-lg shadow-pink-500/30 transition group-hover:scale-110">
            🪞
          </span>
          <span className="text-xl font-black tracking-tight text-neutral-900">
            نوبینو<span className="text-gradient">.</span>
          </span>
        </Link>

        {/* دسکتاپ */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl px-3.5 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-pink-50 hover:text-pink-700">
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="mr-2 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.03] hover:shadow-pink-500/40">
            {t("nav.login")}
          </Link>
          <span className="mr-2"><LangSwitch /></span>
          <span className="mr-1"><ThemeToggle /></span>
        </nav>

        {/* موبایل */}
        <div className="flex items-center gap-2 md:hidden">
          <LangSwitch />
          <ThemeToggle />
          <button onClick={() => setMobileOpen((o) => !o)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-xl dark:bg-neutral-800" aria-label="منو">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-pink-50">
                {l.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setMobileOpen(false)} className="mt-1 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 px-3 py-2.5 text-center text-sm font-bold text-white">
              {t("nav.login")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
