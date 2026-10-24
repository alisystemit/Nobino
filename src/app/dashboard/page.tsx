import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import DashboardShell from "@/components/DashboardShell";

// دسترسی به cookies و دیتابیس در هنگام درخواست (نه در prerender)
export const instant = false;

const roleLabels: Record<string, string> = {
  ADMIN: "سوپرادمین",
  SALON_OWNER: "آرایشگر / مالک سالن",
  AGENT: "نماینده",
  CUSTOMER: "مشتری",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cards = [
    ...(user.role === "SALON_OWNER" || user.role === "ADMIN"
      ? [
          { title: "سالن من", desc: "صفحه عمومی، خدمات، گالری و ساعات کاری", href: "/dashboard/salon", icon: "🪞" },
          { title: "نوبت‌ها", desc: "تأیید و مدیریت نوبت‌ها", href: "/dashboard/appointments", icon: "📅" },
        ]
      : []),
    ...(user.role === "CUSTOMER"
      ? [
          { title: "حساب من", desc: "نوبت‌ها، تاریخچه، علاقه‌مندی‌ها و نظرات", href: "/dashboard/account", icon: "👤" },
          { title: "جستجوی سالن", desc: "یافتن سالن بر اساس شهر، خدمت و قیمت", href: "/salons", icon: "🔎" },
        ]
      : []),
    ...(user.role === "AGENT" || user.role === "ADMIN"
      ? [{ title: "کمیسیون‌ها", desc: "نمایش درصد و درآمد نمایندگی", href: "/dashboard/commission", icon: "📈" }]
      : []),
    { title: "کیف پول", desc: "موجودی و تراکنش‌ها", href: "/dashboard/wallet", icon: "💰" },
    { title: "خرید پکیج", desc: "فروش و فعال‌سازی اشتراک", href: "/packages", icon: "🧾" },
  ];

  const displayName = user.name ?? user.email ?? user.phone;
  const isEmailAccount = user.phone.startsWith("email:");

  return (
    <DashboardShell role={user.role} title="داشبورد">
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-bl from-pink-600 via-rose-600 to-purple-700 p-6 text-white shadow-lg shadow-pink-500/15 sm:p-8">
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="relative">
          <h1 className="text-2xl font-black">سلام، {displayName} 👋</h1>
          <p className="mt-1 text-white/80">
            نقش: {roleLabels[user.role] ?? user.role} — {isEmailAccount ? `ایمیل: ${user.email ?? "—"}` : `شماره: ${toPersianDigits(user.phone)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="group card-hover relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 text-xl dark:from-pink-900/40 dark:to-purple-900/40">{c.icon}</div>
            <h3 className="mt-3 font-extrabold text-neutral-900 dark:text-neutral-100">{c.title}</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{c.desc}</p>
            <span className="mt-3 inline-block text-sm font-bold text-pink-600">مشاهده ←</span>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
