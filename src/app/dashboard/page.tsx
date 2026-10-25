import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import DashboardShell from "@/components/DashboardShell";
import { PanelCard } from "@/components/ui/Stats";
import {
  Store,
  CalendarDays,
  Mic,
  User,
  Search,
  Percent,
  Wallet,
  Package,
  ArrowLeft,
} from "lucide-react";

// دسترسی به cookies و دیتابیس در هنگام درخواست (نه در prerender)
export const instant = false;

const roleLabels: Record<string, string> = {
  ADMIN: "سوپرادمین",
  SALON_OWNER: "آرایشگر / مالک سالن",
  AGENT: "نماینده",
  CUSTOMER: "مشتری",
};

type QuickCard = { title: string; desc: string; href: string; icon: React.ComponentType<{ className?: string }>; cls: string };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cards: QuickCard[] = [
    ...(user.role === "SALON_OWNER" || user.role === "ADMIN"
      ? [
          { title: "سالن من", desc: "صفحه عمومی، خدمات، گالری و ساعات کاری", href: "/dashboard/salon", icon: Store, cls: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300" },
          { title: "نوبت‌ها", desc: "تأیید و مدیریت نوبت‌ها", href: "/dashboard/appointments", icon: CalendarDays, cls: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" },
          { title: "رزرو صوتی", desc: "ثبت نوبت با صدای فارسی", href: "/dashboard/voice-booking", icon: Mic, cls: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300" },
        ]
      : []),
    ...(user.role === "CUSTOMER"
      ? [
          { title: "حساب من", desc: "نوبت‌ها، تاریخچه، علاقه‌مندی‌ها و نظرات", href: "/dashboard/account", icon: User, cls: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300" },
          { title: "نوبت‌های من", desc: "مشاهده، تغییر زمان یا لغو نوبت‌ها", href: "/dashboard/appointments", icon: CalendarDays, cls: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" },
          { title: "جستجوی سالن", desc: "یافتن سالن بر اساس شهر، خدمت و قیمت", href: "/salons", icon: Search, cls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" },
        ]
      : []),
    ...(user.role === "AGENT" || user.role === "ADMIN"
      ? [{ title: "کمیسیون‌ها", desc: "نمایش درصد و درآمد نمایندگی", href: "/dashboard/commission", icon: Percent, cls: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" }]
      : []),
    { title: "کیف پول", desc: "موجودی و تراکنش‌ها", href: "/dashboard/wallet", icon: Wallet, cls: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300" },
    ...(user.role !== "CUSTOMER"
      ? [{ title: "خرید پکیج", desc: "فروش و فعال‌سازی اشتراک", href: "/packages", icon: Package, cls: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" }]
      : []),
  ];

  const displayName = user.name ?? user.email ?? user.phone;
  const isEmailAccount = user.phone.startsWith("email:");

  return (
    <DashboardShell role={user.role} title="داشبورد">
      {/* خوش‌آمد */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-l from-pink-600 via-rose-600 to-purple-700 p-6 text-white shadow-lg shadow-pink-500/15 sm:p-7">
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <h1 className="text-xl font-black sm:text-2xl">سلام، {displayName} 👋</h1>
          <p className="mt-1.5 text-sm text-white/80">
            نقش: {roleLabels[user.role] ?? user.role}
            <span className="mx-2 text-white/30">|</span>
            {isEmailAccount ? `ایمیل: ${user.email ?? "—"}` : `شماره: ${toPersianDigits(user.phone)}`}
          </p>
        </div>
      </div>

      <PanelCard
        title="دسترسی سریع"
        subtitle="بخش‌هایی که برای نقش شما فعال است"
        bodyClassName="p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.title}
                href={c.href}
                className="group flex items-start gap-4 rounded-2xl border border-neutral-200 p-4 transition hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-pink-800"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.cls}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold text-neutral-900 dark:text-neutral-100">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{c.desc}</span>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-pink-600 transition group-hover:gap-2">
                    مشاهده
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </PanelCard>
    </DashboardShell>
  );
}
