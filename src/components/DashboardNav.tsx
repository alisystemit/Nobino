import Link from "next/link";

const links = [
  { href: "/dashboard", label: "خانه", icon: "🏠" },
  { href: "/dashboard/salon", label: "سالن من", icon: "🪞", roles: ["SALON_OWNER", "ADMIN"] },
  { href: "/dashboard/appointments", label: "نوبت‌ها", icon: "📅", roles: ["SALON_OWNER", "ADMIN"] },
  { href: "/dashboard/wallet", label: "کیف پول", icon: "💰" },
  { href: "/dashboard/commission", label: "کمیسیون", icon: "📈", roles: ["AGENT", "ADMIN"] },
  { href: "/dashboard/admin", label: "مدیریت کل", icon: "🛡️", roles: ["ADMIN"] },
  { href: "/packages", label: "پکیج‌ها", icon: "🧾" },
];

export default function DashboardNav({ role }: { role: string }) {
  const visible = links.filter((l) => !l.roles || l.roles.includes(role));
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-3">
        <Link href="/" className="ml-2 text-lg font-black text-pink-600">
          نوبینو
        </Link>
        {visible.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-pink-50 hover:text-pink-700"
          >
            <span className="mr-1">{l.icon}</span> {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
