"use client";

import { useEffect, useState } from "react";
import { toPersianDigits, toJalali } from "@/lib/utils";
import DashboardShell from "@/components/DashboardShell";
import RescheduleModal from "@/components/RescheduleModal";
import { PanelCard, Badge } from "@/components/ui/Stats";
import { CalendarDays } from "lucide-react";

type Appointment = {
  id: string;
  customerName: string;
  customerPhone: string;
  startAt: string;
  status: string;
  channel: string;
  service?: string;
  serviceId?: string | null;
  salonId?: string;
  salonName?: string;
  salonSlug?: string;
  salonTimezone?: string;
  employee?: string;
  employeeId?: string | null;
  branchId?: string | null;
};

const statusLabel: Record<string, string> = {
  REQUESTED: "در انتظار",
  CONFIRMED: "تأیید شده",
  COMPLETED: "انجام شده",
  CANCELLED: "لغو شده",
  NO_SHOW: "مراجعه نکرد",
};
const statusTone: Record<string, "warning" | "success" | "info" | "danger" | "neutral"> = {
  REQUESTED: "warning",
  CONFIRMED: "success",
  COMPLETED: "info",
  CANCELLED: "danger",
  NO_SHOW: "neutral",
};

const channelLabel: Record<string, string> = {
  VOICE: "🎙️ صوتی",
  MANUAL: "✍️ دستی",
  WEBAPP: "🌐 آنلاین",
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [filter, setFilter] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState("");

  function load() {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || "خطا");
        setAppointments(data.appointments);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "خطا");
      })
      .finally(() => {
        setLoading(false);
      });
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

  function reschedule(a: Appointment) {
    setRescheduleTarget(a);
  }

  const filtered = filter ? appointments.filter((a) => a.status === filter) : appointments;

  const counts = {
    all: appointments.length,
    requested: appointments.filter((a) => a.status === "REQUESTED").length,
    confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
  };

  if (loading) return <DashboardShell role={role} title="نوبت‌ها"><p className="py-10 text-center text-neutral-400">در حال بارگیری...</p></DashboardShell>;

  return (
    <DashboardShell role={role} title="نوبت‌ها">
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">{error}</p>}

      <PanelCard
        title="فهرست نوبت‌ها"
        subtitle={`${toPersianDigits(counts.all)} نوبت — ${toPersianDigits(counts.requested)} در انتظار تأیید`}
        icon={<CalendarDays className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-1.5">
            {[
              ["", "همه"],
              ["REQUESTED", "در انتظار"],
              ["CONFIRMED", "تأیید شده"],
              ["COMPLETED", "انجام شده"],
              ["CANCELLED", "لغو شده"],
            ].map(([v, l]) => (
              <button
                key={l}
                onClick={() => setFilter(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  filter === v ? "bg-[#1c2434] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60">
                <th className="px-5 py-3.5 font-bold">مشتری</th>
                <th className="px-5 py-3.5 font-bold">خدمت</th>
                <th className="px-5 py-3.5 font-bold">زمان</th>
                <th className="px-5 py-3.5 font-bold">کانال</th>
                <th className="px-5 py-3.5 font-bold">وضعیت</th>
                <th className="px-5 py-3.5 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-neutral-400">
                    نوبتی ثبت نشده است.
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 dark:border-neutral-800 dark:hover:bg-neutral-800/30">
                  <td className="px-5 py-4">
                    <div className="font-bold text-neutral-800 dark:text-neutral-100">{a.customerName}</div>
                    <div className="text-xs text-neutral-400" dir="ltr">
                      {toPersianDigits(a.customerPhone)}
                    </div>
                    {a.employee && <div className="mt-0.5 text-[10px] text-neutral-400">👩‍🎨 {a.employee}</div>}
                  </td>
                  <td className="px-5 py-4 text-neutral-600 dark:text-neutral-300">{a.service ?? "—"}</td>
                  <td className="px-5 py-4 text-neutral-600 dark:text-neutral-300">{toJalali(a.startAt)}</td>
                  <td className="px-5 py-4 text-xs text-neutral-500 dark:text-neutral-400">{channelLabel[a.channel] ?? a.channel}</td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status]}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    {role === "CUSTOMER" ? (
                      a.salonSlug ? (
                        <div className="flex flex-col gap-1.5">
                          {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                            <button onClick={() => reschedule(a)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600">
                              تغییر زمان
                            </button>
                          )}
                          {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                            <button onClick={() => cancelMine(a.id)} className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200">
                              لغو نوبت
                            </button>
                          )}
                          <a href={`/s/${a.salonSlug}`} className="rounded-lg bg-pink-50 px-3 py-1.5 text-center text-xs font-bold text-pink-600 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300">
                            رزرو مجدد
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.status === "REQUESTED" && (
                          <button
                            onClick={() => updateStatus(a.id, "CONFIRMED")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                          >
                            تأیید
                          </button>
                        )}
                        {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                          <>
                            <button
                              onClick={() => reschedule(a)}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600"
                            >
                              جابه‌جایی
                            </button>
                            <button
                              onClick={() => updateStatus(a.id, "COMPLETED")}
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700"
                            >
                              انجام شد
                            </button>
                            <button
                              onClick={() => noShow(a.id)}
                              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                              عدم حضور
                            </button>
                            <button
                              onClick={() => cancelWithReason(a.id)}
                              className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200"
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
      </PanelCard>

      {rescheduleTarget && (
        <RescheduleModal
          appointmentId={rescheduleTarget.id}
          salonSlug={rescheduleTarget.salonSlug}
          serviceId={rescheduleTarget.serviceId}
          employeeId={rescheduleTarget.employeeId}
          branchId={rescheduleTarget.branchId}
          timezone={rescheduleTarget.salonTimezone}
          onClose={() => setRescheduleTarget(null)}
          onDone={(text) => {
            setRescheduleTarget(null);
            setError("");
            setNotice(text);
            load();
          }}
        />
      )}
    </DashboardShell>
  );
}
