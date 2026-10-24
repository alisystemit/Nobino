"use client";

import { useEffect, useState } from "react";

type ChartData = { months: string[]; revenue: number[]; userGrowth: number[]; appointments: number[]; cancelled: number[]; churn: number[] };

function Line({ data, color, labels, format }: { data: number[]; color: string; labels: string[]; format?: (v: number) => string }) {
  const W = 640, H = 180, PAD = 26;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {Array.from({ length: 5 }, (_, i) => {
        const yy = PAD + (i * (H - PAD * 2)) / 4;
        return <line key={i} x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="#e5e7eb" strokeWidth={1} />;
      })}
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

export default function AdminCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/charts");
      const d = await res.json();
      if (d.success) setData(d);
      else setError(d.error || "خطا");
    })();
  }, []);

  if (error) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-6 text-center text-neutral-400">در حال بارگیری نمودارها...</p>;

  const inv = (v: number) => v.toLocaleString("fa-IR");

  return (
    <div className="space-y-6">
      {[
        { title: "درآمد ماهانه (تومان)", data: data.revenue, color: "#ec4899", fmt: inv },
        { title: "رشد کاربران جدید", data: data.userGrowth, color: "#8b5cf6", fmt: inv },
        { title: "نوبت‌های ثبت‌شده", data: data.appointments, color: "#0ea5e9", fmt: inv },
        { title: "نوبت‌های لغو/عدم حضور", data: data.cancelled, color: "#f43f5e", fmt: inv },
        { title: "ریزش اشتراک (لغو/منقضی)", data: data.churn, color: "#f59e0b", fmt: inv },
      ].map((c) => (
        <div key={c.title} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h4 className="mb-2 text-sm font-extrabold text-neutral-800 dark:text-neutral-200">{c.title}</h4>
          <Line data={c.data} color={c.color} labels={data.months} format={c.fmt} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.months.map((m, i) => (
              <span key={m} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
