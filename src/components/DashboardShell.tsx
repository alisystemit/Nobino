"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/lib/theme";
import { LangSwitch } from "@/lib/i18n";

type NavItem = { href: string; label: string; icon: string; roles?: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4v2h4V7H6Zm6 0v2h6V7h-6Zm-6 4v2h4v-2H6Zm6 0v2h6v-2h-6Zm-6 4v2h4v-2H6Zm6 0v2h6v-2h-6Z" },
  { href: "/dashboard/salon", label: "سالن من", icon: "M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.5 3.6v6.2L12 17.7 5.5 14.1V7.9L12 4.3ZM11 8h2v6h-2V8Zm0 7h2v2h-2v-2Z", roles: ["SALON_OWNER", "ADMIN"] },
  { href: "/dashboard/appointments", label: "نوبت‌ها", icon: "M7 2h10v2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm0 4H5v14h14V6h-2v2H7V6Zm2 7h2v2H9v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Z" },
  { href: "/dashboard/wallet", label: "کیف پول", icon: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 0v12h16V6H4Zm11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  { href: "/dashboard/commission", label: "کمیسیون", icon: "M4 19V5h3v14H4Zm6 0V9h3v10h-3Zm6 0V3h3v16h-3Z", roles: ["AGENT", "ADMIN"] },
  { href: "/dashboard/admin", label: "مدیریت", icon: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 2.2 6 2.3v4.5c0 3.9-2.5 7.4-6 8.8-3.5-1.4-6-4.9-6-8.8V6.5l6-2.3ZM11 7h2v6h-2V7Zm0 7h2v2h-2v-2Z", roles: ["ADMIN"] },
  { href: "/dashboard/account", label: "حساب", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm4 14v-2a4 4 0 0 0-8 0v2H6v-2a6 6 0 0 1 12 0v2h-2Z" },
  { href: "/packages", label: "پکیج‌ها", icon: "M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Zm14-2 3 3-3 3-1.4-1.4L17.2 17H14v-2h3.2l-.6-.6L18 14Z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function DashboardShell({ role, title, children }: { role: string; title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white">🪞</span>
        <span className="text-lg font-black text-neutral-900 dark:text-neutral-100">نوبینو</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive(n.href)
                ? "bg-gradient-to-l from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/25"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
            }`}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <LangSwitch />
        <ThemeToggle />
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* دسکتاپ */}
      <div className="hidden lg:block sticky top-16 h-[calc(100vh-4rem)]">{Sidebar}</div>
      {/* موبایل */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full shadow-2xl">{Sidebar}</div>
        </div>
      )}

      {/* محتوا */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-16 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-[var(--bg)]/85 px-4 backdrop-blur dark:border-neutral-800 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-lg lg:hidden dark:bg-neutral-800" aria-label="منو">
              ☰
            </button>
            <h1 className="text-base font-black text-neutral-900 dark:text-neutral-100 sm:text-lg">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="hidden items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 sm:flex dark:bg-neutral-800 dark:text-neutral-300">
              🏠 بازگشت
            </Link>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
