import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import DashboardNav from "@/components/DashboardNav";

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
    <main className="mx-auto max-w-6xl px-6 py-12">
      <DashboardNav role={user.role} />

      <div className="mt-8 rounded-3xl bg-gradient-to-bl from-pink-500 to-purple-600 p-8 text-white">
        <h1 className="text-2xl font-black">سلام، {displayName} 👋</h1>
        <p className="mt-1 text-white/80">
          نقش: {roleLabels[user.role] ?? user.role} — {isEmailAccount ? `ایمیل: ${user.email ?? "—"}` : `شماره: ${toPersianDigits(user.phone)}`}
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="text-3xl">{c.icon}</div>
            <h3 className="mt-3 font-bold text-neutral-900">{c.title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
