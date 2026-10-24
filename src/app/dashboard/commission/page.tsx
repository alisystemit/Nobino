"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatToman } from "@/lib/utils";
import DashboardShell from "@/components/DashboardShell";

type Summary = {
  balance: number;
  totalEarned: number;
  activePlanCount: number;
  totalEarnedLabel: string;
  balanceLabel: string;
  plans: { salonName: string; slug: string; percent: number }[];
};

export default function CommissionPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/commission");
      const data = await res.json();
      if (data.success) setSummary(data.summary);
      else setError(data.error || "دسترسی غیرمجاز");
    })();
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-red-600">{error}</p>
      </main>
    );
  }

  if (!summary) return <DashboardShell role="AGENT" title="کمیسیون"><p className="py-10 text-center text-neutral-400">در حال بارگیری...</p></DashboardShell>;

  return (
    <DashboardShell role="AGENT" title="کمیسیون نمایندگی">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="مجموع درآمد کمیسیون" value={summary.totalEarnedLabel} icon="📈" />
        <Card label="موجودی فعلی" value={summary.balanceLabel} icon="💰" />
        <Card label="نمایندگی فعال" value={String(summary.activePlanCount)} icon="🤝" />
      </div>

      <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">سالن‌های تحت نمایندگی</h2>
        {summary.plans.length === 0 ? (
          <p className="py-8 text-center text-neutral-400">هیچ نمایندگی فعالی وجود ندارد.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {summary.plans.map((p) => (
              <div key={p.slug} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3 dark:border-neutral-800">
                <div className="font-bold text-neutral-800 dark:text-neutral-100">{p.salonName}</div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 dark:bg-pink-900/40">
                    {p.percent}٪
                  </span>
                  <Link href={`/s/${p.slug}`} className="text-sm text-pink-600 hover:underline">
                    مشاهده
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function Card({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-2xl">{icon}</div>
      <div className="mt-3 text-2xl font-black text-neutral-900 dark:text-neutral-100">{value}</div>
      <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}
