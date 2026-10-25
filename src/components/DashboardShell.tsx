"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Store,
  CalendarDays,
  Mic,
  Percent,
  Wallet,
  Package,
  User,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  Home,
} from "lucide-react";
import { ThemeToggle } from "@/lib/theme";
import { LangSwitch } from "@/lib/i18n";
import NotificationBell from "@/components/NotificationBell";
import SalonIcon from "@/components/icons/SalonIcon";

/**
 * قاب داشبورد به سبک قالب مدیریتی TailAdmin:
 * سایدبار تیره با آیکون، بخش‌بندی منو، کارت پروفایل کاربر در پایین،
 * قابلیت جمع‌شدن سایدبار و هدر با نان‌راهنما.
 */
type NavItem = { href: string; label: string; roles?: string[]; icon: React.ComponentType<{ className?: string }> };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "منو",
    items: [
      { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
      { href: "/dashboard/salon", label: "سالن من", icon: Store, roles: ["SALON_OWNER", "ADMIN"] },
      { href: "/dashboard/appointments", label: "نوبت‌ها", icon: CalendarDays, roles: ["SALON_OWNER", "ADMIN", "CUSTOMER"] },
      { href: "/dashboard/voice-booking", label: "رزرو صوتی", icon: Mic, roles: ["SALON_OWNER", "ADMIN"] },
      { href: "/dashboard/commission", label: "کمیسیون", icon: Percent, roles: ["AGENT", "ADMIN"] },
    ],
  },
  {
    title: "مالی",
    items: [
      { href: "/dashboard/wallet", label: "کیف پول", icon: Wallet },
      { href: "/packages", label: "پکیج‌ها", icon: Package, roles: ["SALON_OWNER", "AGENT", "ADMIN"] },
    ],
  },
  {
    title: "حساب",
    items: [
      { href: "/dashboard/account", label: "حساب من", icon: User },
      { href: "/admin", label: "سوپرادمین", icon: ShieldCheck, roles: ["ADMIN"] },
    ],
  },
];

const roleLabels: Record<string, string> = {
  ADMIN: "سوپرادمین",
  SALON_OWNER: "آرایشگر / مالک سالن",
  AGENT: "نماینده",
  CUSTOMER: "مشتری",
};

type Me = { name?: string | null; phone?: string; avatarUrl?: string | null };

function UserAvatar({ me, className }: { me: Me | null; className?: string }) {
  if (me?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={me.avatarUrl} alt="آواتار" className={`h-10 w-10 shrink-0 rounded-full object-cover ${className ?? ""}`} />
    );
  }
  const initial = (me?.name ?? me?.phone ?? "؟").trim().slice(0, 1);
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-base font-black text-white ${className ?? ""}`}>
      {initial}
    </span>
  );
}

export default function DashboardShell({ role, title, children }: { role: string; title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) setMe(data.user);
      } catch {
        /* بی‌صدا */
      }
    })();
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const Sidebar = (
    <aside
      className={`flex h-full flex-col bg-[#1c2434] text-neutral-300 transition-all duration-300 ${
        collapsed ? "w-[88px]" : "w-72"
      }`}
    >
      {/* لوگو */}
      <div className={`flex h-16 items-center gap-3 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-900/40">
            <SalonIcon className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="truncate">
              <span className="block text-base font-black text-white">نوبینو</span>
              <span className="block text-[10px] text-neutral-400">نوبت‌دهی هوشمند آرایشگاه</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`hidden items-center justify-center rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white lg:flex ${collapsed ? "" : ""}`}
          aria-label={collapsed ? "باز کردن منو" : "بستن منو"}
          title={collapsed ? "باز کردن منو" : "بستن منو"}
        >
          {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </button>
      </div>

      {/* منو */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
        {SECTIONS.map((section) => {
          const items = section.items.filter((n) => !n.roles || n.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.title}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{section.title}</div>
              )}
              <div className="space-y-1">
                {items.map((n) => {
                  const active = isActive(n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      title={collapsed ? n.label : undefined}
                      className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        collapsed ? "justify-center px-2" : ""
                      } ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                      }`}
                    >
                      {active && <span className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-pink-500 to-purple-500" />}
                      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-pink-400" : ""}`} />
                      {!collapsed && <span className="truncate">{n.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* پروفایل */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
        <div className="flex items-center gap-3">
          <UserAvatar me={me} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{me?.name ?? me?.phone ?? "کاربر نوبینو"}</div>
              <div className="truncate text-[11px] text-neutral-400">{roleLabels[role] ?? role}</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-500/15 hover:text-red-400"
              aria-label="خروج از حساب"
              title="خروج از حساب"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#f3f5f9] dark:bg-neutral-950">
      {/* دسکتاپ */}
      <div className="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 lg:block">{Sidebar}</div>

      {/* موبایل */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full shadow-2xl">
            <div className="flex h-16 items-center justify-between bg-[#1c2434] px-4">
              <span className="text-base font-black text-white">نوبینو</span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-white/10"
                aria-label="بستن منو"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">{Sidebar}</div>
          </div>
        </div>
      )}

      {/* محتوا */}
      <div className="min-w-0 flex-1">
        {/* هدر */}
        <div className="sticky top-16 z-20 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/85 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 lg:hidden dark:bg-neutral-800 dark:text-neutral-300"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <Link href="/" className="flex items-center gap-1 transition hover:text-pink-600">
                  <Home className="h-3 w-3" />
                  نوبینو
                </Link>
                <span>/</span>
                <span className="truncate text-neutral-500 dark:text-neutral-400">{title}</span>
              </div>
              <h1 className="truncate text-base font-black text-neutral-900 sm:text-lg dark:text-neutral-100">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <NotificationBell />
            <LangSwitch />
            <ThemeToggle />
            <Link
              href="/help"
              className="hidden items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-200 md:flex dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              <HelpCircle className="h-4 w-4" />
              راهنما
            </Link>
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-200 md:flex dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              بازگشت به سایت
            </Link>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
