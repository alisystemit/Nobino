"use client";

import { useEffect, useState } from "react";
import { toPersianDigits, toJalali } from "@/lib/utils";

type Appointment = {
  id: string;
  customerName: string;
  customerPhone: string;
  startAt: string;
  status: string;
  channel: string;
  service?: string;
  salonName?: string;
  salonSlug?: string;
};

const statusLabel: Record<string, string> = {
  REQUESTED: "در انتظار",
  CONFIRMED: "تأیید شده",
  COMPLETED: "انجام شده",
  CANCELLED: "لغو شده",
  NO_SHOW: "مراجعه نکرد",
};
const statusColor: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-sky-50 text-sky-700",
  CANCELLED: "bg-red-50 text-red-600",
  NO_SHOW: "bg-neutral-100 text-neutral-500",
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      setAppointments(data.appointments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const meData = await me.json();
      setRole(meData.user?.role ?? "");
    })();
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) load();
    else setError(data.error || "خطا");
  }

  async function cancelMine(id: string) {
    const res = await fetch(`/api/appointments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.success) load();
    else setError(data.error || "خطا");
  }

  async function cancelWithReason(id: string) {
    const reason = window.prompt("دلیل لغو (اختیاری):") ?? "";
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED", cancelReason: reason || undefined }),
    });
    const data = await res.json();
    if (data.success) load();
    else setError(data.error || "خطا");
  }

  async function noShow(id: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "NO_SHOW" }),
    });
    const data = await res.json();
    if (data.success) load();
    else setError(data.error || "خطا");
  }

  async function rescheduleMine(id: string) {
    const raw = prompt("زمان جدید را وارد کنید (مثال: 2026-10-25T16:00)"); 
    if (!raw) return;
    const res = await fetch(`/api/appointments/${id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: new Date(raw).toISOString() }),
    });
    const data = await res.json();
    if (data.success) load();
    else setError(data.error || "خطا");
  }

  if (loading) return <main className="mx-auto max-w-6xl px-6 py-12 text-center text-neutral-400">در حال بارگیری...</main>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-black text-neutral-900">نوبت‌ها</h1>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <th className="px-5 py-3">مشتری</th>
              <th className="px-5 py-3">خدمت</th>
              <th className="px-5 py-3">زمان</th>
              <th className="px-5 py-3">وضعیت</th>
              <th className="px-5 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-neutral-400">
                  نوبتی ثبت نشده است.
                </td>
              </tr>
            )}
            {appointments.map((a) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-5 py-4">
                  <div className="font-bold text-neutral-800">{a.customerName}</div>
                  <div className="text-xs text-neutral-400" dir="ltr">
                    {toPersianDigits(a.customerPhone)}
                  </div>
                </td>
                <td className="px-5 py-4 text-neutral-600">{a.service ?? "—"}</td>
                <td className="px-5 py-4 text-neutral-600">{toJalali(a.startAt)}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {role === "CUSTOMER" ? (
                    a.salonSlug ? (
                      <div className="flex flex-col gap-1.5">
                        {a.status === "REQUESTED" && (
                          <button onClick={() => rescheduleMine(a.id)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">
                            تغییر زمان
                          </button>
                        )}
                        {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                          <button onClick={() => cancelMine(a.id)} className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-300">
                            لغو نوبت
                          </button>
                        )}
                        <a href={`/s/${a.salonSlug}`} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-center text-xs font-bold text-pink-600 hover:bg-pink-50">
                          رزرو مجدد
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )
                  ) : (
                    <div className="flex gap-1.5">
                      {a.status === "REQUESTED" && (
                        <button
                          onClick={() => updateStatus(a.id, "CONFIRMED")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          تأیید
                        </button>
                      )}
                      {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                        <>
                          <button
                            onClick={() => updateStatus(a.id, "COMPLETED")}
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
                          >
                            انجام شد
                          </button>
                          <button
                            onClick={() => noShow(a.id)}
                            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-200"
                          >
                            عدم حضور
                          </button>
                          <button
                            onClick={() => cancelWithReason(a.id)}
                            className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-300"
                          >
                            لغو
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
