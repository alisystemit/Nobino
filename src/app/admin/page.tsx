import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatToman, toPersianDigits } from "@/lib/utils";
import AdminShell from "@/components/AdminShell";
import AdminExtras from "@/components/AdminExtras";

export const instant = false;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;
  const tab = sp.tab ?? "metrics";

  const [salons, customers, subscriptions, paidAgg] = await Promise.all([
    prisma.salon.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const cards = [
    { label: "سالن‌ها", value: toPersianDigits(salons), icon: "🪞" },
    { label: "مشتریان", value: toPersianDigits(customers), icon: "👥" },
    { label: "اشتراک فعال", value: toPersianDigits(subscriptions), icon: "✅" },
    { label: "درآمد کل", value: formatToman(paidAgg._sum.amount ?? 0), icon: "💵" },
  ];

  return (
    <AdminShell title="مدیریت پلتفرم">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-3 text-2xl font-black text-neutral-900 dark:text-neutral-100">{c.value}</div>
            <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <AdminExtras initialTab={tab} />
      </div>
    </AdminShell>
  );
}
