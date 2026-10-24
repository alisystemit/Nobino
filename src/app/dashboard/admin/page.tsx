import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { formatToman, toPersianDigits } from "@/lib/utils";
import SystemSettings from "@/components/SystemSettings";
import AdminExtras from "@/components/AdminExtras";
import DashboardShell from "@/components/DashboardShell";

export const instant = false;

export default async function AdminDashboardPage() {
  await requireRole(["ADMIN"]);

  const [salons, customers, agents, owners, orders, paidAgg, pendingOrders] = await Promise.all([
    prisma.salon.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "AGENT" } }),
    prisma.user.count({ where: { role: "SALON_OWNER" } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  const recentOrders = await prisma.order.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { package: { select: { name: true } }, user: { select: { name: true, phone: true } } },
  });

  const stats = [
    { label: "سالن فعال", value: toPersianDigits(salons), icon: "🪞" },
    { label: "مشتریان", value: toPersianDigits(customers), icon: "👥" },
    { label: "نمایندگان", value: toPersianDigits(agents), icon: "🤝" },
    { label: "آرایشگران", value: toPersianDigits(owners), icon: "💇‍♀️" },
    { label: "کل سفارش‌ها", value: toPersianDigits(orders), icon: "🧾" },
    { label: "درآمد پرداخت‌شده", value: formatToman(paidAgg._sum.amount ?? 0), icon: "💵" },
    { label: "سفارش‌های در انتظار", value: toPersianDigits(pendingOrders), icon: "⏳" },
  ];

  return (
    <DashboardShell role="ADMIN" title="مدیریت کل">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-3 text-2xl font-black text-neutral-900 dark:text-neutral-100">{s.value}</div>
            <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">آخرین سفارش‌ها</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                <th className="px-3 py-2">کاربر</th>
                <th className="px-3 py-2">پکیج</th>
                <th className="px-3 py-2">مبلغ</th>
                <th className="px-3 py-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                  <td className="px-3 py-3 font-bold text-neutral-800 dark:text-neutral-100">
                    {o.user.name ?? o.user.phone}
                  </td>
                  <td className="px-3 py-3 text-neutral-600 dark:text-neutral-400">{o.package.name}</td>
                  <td className="px-3 py-3 text-neutral-600 dark:text-neutral-400">{formatToman(o.amount)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        o.status === "PAID" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40" : "bg-amber-50 text-amber-700 dark:bg-amber-900/40"
                      }`}
                    >
                      {o.status === "PAID" ? "پرداخت‌شده" : "در انتظار"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">مدیریت پلتفرم</h2>
        <div className="mt-6">
          <AdminExtras />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">تنظیمات سیستم</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          مدیریت پویای کلیدهای API، انتخاب سرویس پیامک فعال و سایر پیکربندی‌ها (بدون نیاز به تغییر کد/استقرار مجدد).
        </p>
        <div className="mt-6">
          <SystemSettings />
        </div>
      </div>
    </DashboardShell>
  );
}
