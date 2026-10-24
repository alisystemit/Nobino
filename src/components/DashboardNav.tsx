"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "خانه", icon: "🏠" },
  { href: "/dashboard/salon", label: "سالن من", icon: "🪞", roles: ["SALON_OWNER", "ADMIN"] },
  { href: "/dashboard/appointments", label: "نوبت‌ها", icon: "📅", roles: ["SALON_OWNER", "ADMIN"] },
  { href: "/dashboard/wallet", label: "کیف پول", icon: "💰" },
  { href: "/dashboard/commission", label: "کمیسیون", icon: "📈", roles: ["AGENT", "ADMIN"] },
  { href: "/dashboard/admin", label: "مدیریت کل", icon: "🛡️", roles: ["ADMIN"] },
  { href: "/dashboard/account", label: "حساب", icon: "👤" },
  { href: "/packages", label: "پکیج‌ها", icon: "🧾" },
];

export default function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = links.filter((l) => !l.roles || l.roles.includes(role));

  return (
    <nav className="sticky top-16 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2.5 sm:px-6">
        <Link href="/" className="ml-2 flex items-center gap-1.5 text-lg font-black text-pink-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white">🪞</span>
        </Link>
        {visible.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                active ? "bg-gradient-to-l from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/25" : "text-neutral-600 hover:bg-pink-50 hover:text-pink-700"
              }`}
            >
              <span className="mr-1">{l.icon}</span> {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
