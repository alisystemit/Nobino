"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  customerName: string;
  customerPhone: string;
  startAt: string;
  status: string;
  service?: string;
  servicePrice?: number;
  employee?: string;
  note?: string | null;
  depositAmount?: number | null;
  depositPaid?: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: "در انتظار", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  CONFIRMED: { label: "تأییدشده", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  COMPLETED: { label: "انجام‌شده", cls: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  CANCELLED: { label: "لغو", cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300" },
  NO_SHOW: { label: "عدم حضور", cls: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800" },
};

/**
 * برنامه روزانه سالن: مشتریان هر قسمت/خدمت که از قبل رزرو کرده‌اند،
 * با شماره، زمان، پیش‌پرداخت و وضعیت — برای برنامه‌ریزی بهتر.
 */
export default function DailyBoard({ salonId }: { salonId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/appointments?from=${date}&to=${date}`);
      const d = await res.json();
      if (d.success) setRows(d.appointments);
      setLoading(false);
    })();
  }, [date]);

  // گروه‌بندی بر اساس خدمت
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.service || "بدون خدمت";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const total = rows.length;
  const confirmed = rows.filter((r) => r.status === "CONFIRMED").length;
  const prepaid = rows.filter((r) => r.depositPaid).length;
  const revenue = rows.reduce((s, r) => s + (r.status === "COMPLETED" ? r.servicePrice ?? 0 : 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-pink-500 dark:border-neutral-700 dark:bg-neutral-800" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">کل: <b>{total}</b> — تأییدشده: <b>{confirmed}</b> — پیش‌پرداخت: <b>{prepaid}</b> — درآمد انجام‌شده: <b>{revenue.toLocaleString("fa-IR")}</b></span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-neutral-400">در حال بارگیری...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-400">برای این روز نوبتی ثبت نشده است.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([service, list]) => {
            const groupRevenue = list.reduce((s, r) => s + (r.status === "COMPLETED" ? r.servicePrice ?? 0 : 0), 0);
            const groupPrepaid = list.filter((r) => r.depositPaid).length;
            return (
            <div key={service} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-extrabold text-neutral-900 dark:text-neutral-100">💇 {service}</h4>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 dark:bg-pink-900/40">{list.length} نوبت</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40">درآمد {groupRevenue.toLocaleString("fa-IR")}</span>
                  {groupPrepaid > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40">بیعانه {groupPrepaid}</span>}
                </div>
              </div>
              <div className="space-y-2">
                {list.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-neutral-800 dark:text-neutral-100" dir="ltr">{r.startAt.slice(11, 16)}</span>
                      <div>
                        <div className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{r.customerName} <span className="text-xs font-normal text-neutral-400" dir="ltr">{r.customerPhone}</span></div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">{r.employee ? `آرایشگر: ${r.employee}` : ""}{r.note ? ` — ${r.note}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.depositAmount ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.depositPaid ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40" : "bg-amber-50 text-amber-700 dark:bg-amber-900/40"}`}>
                          بیعانه {r.depositAmount.toLocaleString("fa-IR")} {r.depositPaid ? "✓" : ""}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS[r.status]?.cls ?? "bg-neutral-100 text-neutral-500"}`}>
                        {STATUS[r.status]?.label ?? r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
