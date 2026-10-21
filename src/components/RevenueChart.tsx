"use client";

import { useEffect, useState } from "react";

type ChartData = { labels: string[]; appointments: number[]; revenue: number[]; cancelled: number[] };

/** نمودار SVG ساده (بدون وابستگی) — نوبت/درآمد/لغو آخرین ۳۰ روز */
export default function RevenueChart({ salonId }: { salonId: string }) {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/salons/${salonId}/revenue`);
        const d = await res.json();
        if (d.success) setData(d);
        else setError(d.error || "خطا");
      } catch {
        setError("خطا در بارگیری نمودار");
      }
    })();
  }, [salonId]);

  if (error) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-6 text-center text-sm text-neutral-400">در حال بارگیری نمودار...</p>;

  const W = 600, H = 180, PAD = 24;
  const maxRev = Math.max(1, ...data.revenue);
  const maxApp = Math.max(1, ...data.appointments);
  const n = data.labels.length;

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const yRev = (v: number) => H - PAD - (v / maxRev) * (H - PAD * 2);
  const yApp = (v: number) => H - PAD - (v / maxApp) * (H - PAD * 2);

  const revPath = data.revenue.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yRev(v).toFixed(1)}`).join(" ");
  const appPath = data.appointments.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yApp(v).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <h4 className="text-sm font-extrabold text-neutral-800">روند ۳۰ روز اخیر</h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        {Array.from({ length: 5 }, (_, i) => {
          const y = PAD + (i * (H - PAD * 2)) / 4;
          return <line key={i} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
        })}
        <path d={revPath} fill="none" stroke="#ec4899" strokeWidth={2.5} strokeLinecap="round" />
        <path d={appPath} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" />
        {data.revenue.map((v, i) => (
          <circle key={i} cx={x(i)} cy={yRev(v)} r={2.5} fill="#ec4899" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-full bg-pink-500" /> درآمد (تومان)
        </span>
        <span className="flex items-center gap-1.5 text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> تعداد نوبت
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          ["مجموع درآمد", data.revenue.reduce((s, v) => s + v, 0).toLocaleString("fa-IR")],
          ["نوبت‌ها", data.appointments.reduce((s, v) => s + v, 0).toLocaleString("fa-IR")],
          ["لغوها", data.cancelled.reduce((s, v) => s + v, 0).toLocaleString("fa-IR")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-neutral-50 px-2 py-2">
            <div className="text-sm font-black text-neutral-800">{value}</div>
            <div className="text-[11px] text-neutral-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
