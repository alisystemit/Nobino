"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RevenueChart from "@/components/RevenueChart";

type Service = { id: string; name: string; durationMin: number; price: number; description?: string | null; isActive: boolean };
type StaffItem = {
  id: string;
  name: string;
  title?: string | null;
  role: string;
  commissionPercent: number;
  branchId?: string | null;
  specialties: string[];
  isActive: boolean;
  services?: { id: string; name: string }[];
  schedule?: { day: number; open: string; close: string; isClosed?: boolean }[] | null;
};
type Block = { id: string; startAt: string; endAt: string; reason?: string | null; staff?: { name: string } | null };
type Branch = { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; isActive: boolean };
type CashEntry = { id: string; branch?: { name: string } | null; cashAmount: number; cardAmount: number; onlineAmount: number; expenseAmount: number; note?: string | null; createdAt: string };

type Tab = "services" | "staff" | "blocks" | "booking" | "branches" | "cash" | "report" | "waitlist" | "calendar" | "holidays" | "customers";

export default function SalonManager({ salonId, salonSlug }: { salonId: string; salonSlug?: string }) {
  const [tab, setTab] = useState<Tab>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cash, setCash] = useState<{ entries: CashEntry[]; todayTotals: any }>({ entries: [], todayTotals: null });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const base = `/api/dashboard/salons/${salonId}`;

  const refreshServices = useCallback(async () => {
    const r = await fetch(`${base}/services`);
    const d = await r.json();
    if (d.success) setServices(d.services);
  }, [base]);

  const refreshStaff = useCallback(async () => {
    const r = await fetch(`${base}/staff`);
    const d = await r.json();
    if (d.success) setStaff(d.staff);
  }, [base]);

  const refreshBlocks = useCallback(async () => {
    const r = await fetch(`${base}/blocks`);
    const d = await r.json();
    if (d.success) setBlocks(d.blocks);
  }, [base]);

  const refreshBranches = useCallback(async () => {
    const r = await fetch(`${base}/branches`);
    const d = await r.json();
    if (d.success) setBranches(d.branches);
  }, [base]);

  const refreshCash = useCallback(async () => {
    const r = await fetch(`${base}/cash`);
    const d = await r.json();
    if (d.success) setCash({ entries: d.entries, todayTotals: d.todayTotals });
  }, [base]);

  useEffect(() => {
    refreshServices();
    refreshStaff();
    refreshBlocks();
    refreshBranches();
    refreshCash();
  }, [refreshServices, refreshStaff, refreshBlocks, refreshBranches, refreshCash]);

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.success) {
      setMsg({ ok: false, text: data.error || "خطا" });
      return null;
    }
    setMsg({ ok: true, text: "ذخیره شد ✅" });
    return data;
  }

  const input = "w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-pink-500";

  // ─── خدمات ────────────────────────────────────────────────────────────
  function ServiceForm() {
    const [name, setName] = useState("");
    const [durationMin, setDurationMin] = useState(30);
    const [price, setPrice] = useState(0);
    async function submit() {
      await api(`${base}/services`, "POST", { name, durationMin, price });
      refreshServices();
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_100px_120px_auto]">
        <input className={input} placeholder="نام خدمت" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} type="number" placeholder="مدت (دق)" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        <input className={input} type="number" placeholder="قیمت (تومان)" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        <button onClick={submit} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">افزودن</button>
      </div>
    );
  }

  // ─── کارکنان ───────────────────────────────────────────────────────────
  function StaffForm() {
    const [name, setName] = useState("");
    const [title, setTitle] = useState("");
    const [role, setRole] = useState("STYLIST");
    const [commissionPercent, setCommissionPercent] = useState(0);
    const [branchId, setBranchId] = useState("");
    const [specialties, setSpecialties] = useState("");
    async function submit() {
      await api(`${base}/staff`, "POST", {
        name,
        title: title || undefined,
        role,
        commissionPercent: Number(commissionPercent),
        branchId: branchId || undefined,
        specialties: specialties.split("،").map((s) => s.trim()).filter(Boolean),
      });
      refreshStaff();
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_100px_1fr_auto]">
        <input className={input} placeholder="نام کارمند" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
          {["STYLIST", "MANAGER", "RECEPTION", "OWNER"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className={input} type="number" placeholder="کمیسیون ٪" value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} />
        <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">شعبه (همه)</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={submit} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">افزودن</button>
        <div className="sm:col-span-5">
          <input className={input} placeholder="سمت نمایشی (مثلاً ارشد) و تخصص‌ها با ویرگول" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="sm:col-span-5">
          <input className={input} placeholder="تخصص‌ها (با ویرگول)" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
        </div>
      </div>
    );
  }

  function ReportView() {
    const [report, setReport] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [showRevenue, setShowRevenue] = useState(false);
    const [financial, setFinancial] = useState<any>(null);
    const [finFrom, setFinFrom] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
    const [finTo, setFinTo] = useState(new Date().toISOString().slice(0, 10));
    useEffect(() => {
      (async () => { const r = await fetch(`${base}/report`); const d = await r.json(); if (d.success) setReport(d.report); })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function analyze() {
      setAiLoading(true);
      try {
        const r = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salonId }) });
        const d = await r.json();
        setAiAnalysis(d.summary ?? d.error);
      } catch {
        setAiAnalysis("خطا در تحلیل");
      } finally {
        setAiLoading(false);
      }
    }

    async function loadFinancial() {
      const r = await fetch(`${base}/financial?from=${finFrom}&to=${finTo}`);
      const d = await r.json();
      if (d.success) setFinancial(d.report);
      else setMsg({ ok: false, text: d.error || "خطا" });
    }
    if (!report) return <p className="py-6 text-center text-neutral-400">در حال محاسبه گزارش...</p>;
    const cards = [
      { label: "کل نوبت‌ها", value: String(report.total), icon: "📋" },
      { label: "انجام‌شده", value: String(report.completed), icon: "✅" },
      { label: "نرخ لغو", value: `${report.cancelRate}٪`, icon: "❌" },
      { label: "مشتریان متمایز", value: String(report.distinctCustomers), icon: "👥" },
      { label: "نرخ مراجعه مجدد", value: `${report.returnRate}٪`, icon: "🔁" },
      { label: "مشتری جدید امروز", value: String(report.newCustomersToday), icon: "🆕" },
    ];
    return (
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={analyze} disabled={aiLoading} className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50">
            {aiLoading ? "در حال تحلیل..." : "🤖 تحلیل با هوش مصنوعی"}
          </button>
          <button onClick={() => setShowRevenue((s) => !s)} className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700">
            {showRevenue ? "پنهان‌سازی نمودار" : "📊 نمودار درآمد"}
          </button>
        </div>
        {showRevenue && <div className="mb-4"><RevenueChart salonId={salonId} /></div>}

        {/* گزارش مالی بازه‌ای */}
        <div className="mb-4 rounded-2xl border border-neutral-200 p-4">
          <h4 className="text-sm font-extrabold text-neutral-800">گزارش مالی بازه‌ای</h4>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] font-medium text-neutral-500">از</label>
              <input type="date" className={input} value={finFrom} onChange={(e) => setFinFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-neutral-500">تا</label>
              <input type="date" className={input} value={finTo} onChange={(e) => setFinTo(e.target.value)} />
            </div>
            <button onClick={loadFinancial} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">نمایش</button>
          </div>
          {financial && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["درآمد خدمات (انجام‌شده)", financial.revenueLabel],
                ["نوبت‌های انجام‌شده", String(financial.completed)],
                ["لغوها", String(financial.cancelled)],
                ["پرداخت اشتراک", financial.paidSubscriptionsLabel],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-neutral-50 px-3 py-2">
                  <div className="text-sm font-black text-neutral-800">{value}</div>
                  <div className="text-[11px] text-neutral-500">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {aiAnalysis && (
          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm leading-relaxed text-purple-900">
            {aiAnalysis}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-2xl">{c.icon}</div>
              <div className="mt-2 text-xl font-black text-neutral-900">{c.value}</div>
              <div className="mt-1 text-xs text-neutral-500">{c.label}</div>
            </div>
          ))}
        </div>
        {report.peakHours.length > 0 && (
          <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <h4 className="text-sm font-extrabold text-neutral-800">ساعات پرتقاضا</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.peakHours.map((p: any) => (
                <span key={p.hour} className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700">
                  {p.hour}:00 — {p.count} نوبت
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
          <h4 className="text-sm font-extrabold text-neutral-800">بهره‌وری کارکنان</h4>
          <div className="mt-2 space-y-2">
            {report.staffPerformance.map((s: any) => (
              <div key={s.id} className="flex justify-between rounded-xl bg-neutral-50 px-4 py-2 text-sm">
                <span className="font-bold text-neutral-700">{s.name}</span>
                <span className="text-neutral-500">{s.completed} انجام‌شده از {s.total}</span>
              </div>
            ))}
            {report.staffPerformance.length === 0 && <p className="text-xs text-neutral-400">کارمندی یافت نشد.</p>}
          </div>
        </div>
      </div>
    );
  }

  function BranchForm() {
    const [name, setName] = useState("");
    const [city, setCity] = useState("");
    const [address, setAddress] = useState("");
    async function submit() {
      await api(`${base}/branches`, "POST", { name, city: city || undefined, address: address || undefined });
      refreshBranches();
      refreshStaff();
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input className={input} placeholder="نام شعبه" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="شهر" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className={input} placeholder="آدرس" value={address} onChange={(e) => setAddress(e.target.value)} />
        <button onClick={submit} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">افزودن</button>
      </div>
    );
  }

  function WaitlistView() {
    const [entries, setEntries] = useState<any[]>([]);
    useEffect(() => {
      (async () => {
        const r = await fetch(`/api/salons/${salonSlug}/waitlist`);
        const d = await r.json();
        if (d.success) setEntries(d.entries);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const statusColor: Record<string, string> = {
      WAITING: "bg-amber-50 text-amber-700",
      NOTIFIED: "bg-sky-50 text-sky-700",
      BOOKED: "bg-emerald-50 text-emerald-700",
      EXPIRED: "bg-neutral-100 text-neutral-500",
    };
    return (
      <div className="space-y-2">
        {entries.length === 0 && <p className="py-6 text-center text-neutral-400">مشتری در صف انتظار نیست.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{e.customerName} <span className="text-xs text-neutral-400" dir="ltr">{e.customerPhone}</span></div>
              <div className="text-xs text-neutral-500">{e.note ?? "بدون توضیح"}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[e.status] ?? "bg-neutral-100 text-neutral-500"}`}>{e.status}</span>
              {e.status === "WAITING" && (
                <button onClick={() => api(`/api/salons/${salonSlug}/waitlist/${e.id}`, "PATCH", { status: "NOTIFIED" }).then(() => {
                  setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: "NOTIFIED" } : x)));
                })} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600">
                  اطلاع‌رسانی شد
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function CalendarView() {
    const [mode, setMode] = useState<"day" | "week" | "month">("week");
    const [anchor, setAnchor] = useState(() => new Date());
    const [appts, setAppts] = useState<any[]>([]);
    const [staffFilter, setStaffFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [loading, setLoading] = useState(false);

    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // بازه نمایش بر اساس نمای انتخابی (هفته از شنبه)
    const range = useMemo(() => {
      const start = new Date(anchor);
      start.setHours(0, 0, 0, 0);
      if (mode === "week") {
        const offset = (start.getDay() + 1) % 7; // شنبه=0
        start.setDate(start.getDate() - offset);
      } else if (mode === "month") {
        start.setDate(1);
        const offset = (start.getDay() + 1) % 7;
        start.setDate(start.getDate() - offset); // شروع از شنبهٔ قبل
      }
      const end = new Date(start);
      if (mode === "day") end.setDate(end.getDate() + 1);
      else if (mode === "week") end.setDate(end.getDate() + 7);
      else end.setMonth(end.getMonth() + 1);
      return { start, end };
    }, [anchor, mode]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const res = await fetch(`/api/appointments?from=${range.start.toISOString()}&to=${range.end.toISOString()}`);
          const data = await res.json();
          if (!cancelled && data.success) setAppts(data.appointments);
        } catch {
          /* ignore */
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [range.start, range.end]);

    function shift(delta: number) {
      const next = new Date(anchor);
      if (mode === "day") next.setDate(next.getDate() + delta);
      else if (mode === "week") next.setDate(next.getDate() + delta * 7);
      else next.setMonth(next.getMonth() + delta);
      setAnchor(next);
    }

    const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
    const filtered = appts.filter((a) => {
      if (staffFilter && a.employee !== staffFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (serviceFilter && a.service !== serviceFilter) return false;
      return true;
    });

    const days: Date[] = [];
    if (mode === "month") {
      const cursor = new Date(range.start);
      while (cursor < range.end) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const count = mode === "day" ? 1 : 7;
      const start = new Date(anchor);
      start.setHours(0, 0, 0, 0);
      if (mode === "week") start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
    }

    const title =
      mode === "day"
        ? anchor.toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long" })
        : mode === "week"
          ? `${range.start.toLocaleDateString("fa-IR", { day: "numeric", month: "long" })} تا ${new Date(range.start.getTime() + 6 * 864e5).toLocaleDateString("fa-IR", { day: "numeric", month: "long" })}`
          : anchor.toLocaleDateString("fa-IR", { month: "long", year: "numeric" });

    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-bold text-neutral-700 hover:bg-neutral-200">قبلی</button>
          <button onClick={() => setAnchor(new Date())} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-bold text-white">امروز</button>
          <button onClick={() => shift(1)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-bold text-neutral-700 hover:bg-neutral-200">بعدی</button>
          <span className="text-sm font-bold text-neutral-700">{title}</span>
          <div className="ms-auto flex gap-1">
            {(["day", "week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === m ? "bg-pink-600 text-white" : "bg-neutral-100 text-neutral-600"}`}
              >
                {m === "day" ? "روز" : m === "week" ? "هفته" : "ماه"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select className={input} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">همه آرایشگران</option>
            {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select className={input} value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="">همه خدمات</option>
            {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading && <p className="mb-2 text-xs text-neutral-400">در حال بارگیری...</p>}

        <div className={mode === "month" ? "grid grid-cols-7 gap-1.5" : mode === "day" ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
          {days.map((day, i) => {
            const key = dayKey(day);
            const dayAppts = filtered
              .filter((a) => dayKey(new Date(a.startAt)) === key)
              .sort((a, b) => a.startAt.localeCompare(b.startAt));
            return (
              <div key={key} className={`rounded-2xl border p-2.5 ${mode === "month" ? "min-h-[110px] border-neutral-200" : "border-neutral-200"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-neutral-800">{dayNames[(day.getDay() + 1) % 7]}</span>
                  <span className="text-[10px] text-neutral-400" dir="ltr">{dayKey(day).slice(5)}</span>
                </div>
                <div className="space-y-1">
                  {dayAppts.length === 0 && mode !== "month" && <p className="text-xs text-neutral-400">نوبتی نیست</p>}
                  {dayAppts.slice(0, mode === "month" ? 3 : 50).map((a) => (
                    <div key={a.id} className="rounded-lg bg-neutral-50 px-2 py-1 text-[11px]">
                      <span className="font-bold text-neutral-700" dir="ltr">
                        {new Date(a.startAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                      </span>{" "}
                      <span className="text-neutral-600">{a.customerName}</span>
                      {a.employee ? <span className="text-neutral-400"> — {a.employee}</span> : null}
                      <div className="text-neutral-400">{a.service ?? ""} · {a.status}</div>
                    </div>
                  ))}
                  {mode === "month" && dayAppts.length > 3 && <div className="text-[10px] text-pink-600">+{dayAppts.length - 3} مورد</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function CashForm() {
    const [branchId, setBranchId] = useState("");
    const [cashAmount, setCashAmount] = useState(0);
    const [cardAmount, setCardAmount] = useState(0);
    const [onlineAmount, setOnlineAmount] = useState(0);
    const [expenseAmount, setExpenseAmount] = useState(0);
    async function submit() {
      await api(`${base}/cash`, "POST", { branchId: branchId || undefined, cashAmount: Number(cashAmount), cardAmount: Number(cardAmount), onlineAmount: Number(onlineAmount), expenseAmount: Number(expenseAmount) });
      refreshCash();
    }
    const t = cash.todayTotals;
    return (
      <div>
        {t && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["نقدی", t.cash],
              ["کارت‌خوان", t.card],
              ["آنلاین", t.online],
              ["هزینه", t.expense],
              ["مانده خالص", t.net],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-2xl border border-neutral-200 p-3 text-center">
                <div className="text-lg font-black text-neutral-900">{Number(val).toLocaleString("fa-IR")}</div>
                <div className="text-xs text-neutral-500">{label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-6">
          <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">شعبه</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className={input} type="number" placeholder="نقدی" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value))} />
          <input className={input} type="number" placeholder="کارت‌خوان" value={cardAmount} onChange={(e) => setCardAmount(Number(e.target.value))} />
          <input className={input} type="number" placeholder="آنلاین" value={onlineAmount} onChange={(e) => setOnlineAmount(Number(e.target.value))} />
          <input className={input} type="number" placeholder="هزینه" value={expenseAmount} onChange={(e) => setExpenseAmount(Number(e.target.value))} />
          <button onClick={submit} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">ثبت</button>
        </div>
      </div>
    );
  }

  // ─── مسدودسازی ────────────────────────────────────────────────────────
  function BlockForm() {
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [reason, setReason] = useState("");
    async function submit() {
      await api(`${base}/blocks`, "POST", { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), reason: reason || undefined });
      refreshBlocks();
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="datetime-local" className={input} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        <input type="datetime-local" className={input} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        <input className={input} placeholder="دلیل (ناهار، تعمیرات...)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={submit} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">مسدودسازی</button>
      </div>
    );
  }

  // ─── ثبت نوبت دستی ─────────────────────────────────────────────────────
  function BookingForm() {
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [serviceId, setServiceId] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [startAt, setStartAt] = useState("");
    const [channel, setChannel] = useState("MANUAL");
    async function submit() {
      if (!startAt) return setMsg({ ok: false, text: "زمان را انتخاب کنید" });
      const r = await api("/api/appointments", "POST", {
        salonId,
        serviceId: serviceId || undefined,
        employeeId: employeeId || undefined,
        customerName,
        customerPhone,
        startAt: new Date(startAt).toISOString(),
        channel,
      });
      if (r) {
        setCustomerName(""); setCustomerPhone(""); setStartAt("");
      }
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-2">
        <input className={input} placeholder="نام مشتری" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className={input} placeholder="شماره موبایل" dir="ltr" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">انتخاب خدمت</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">آرایشگر (اختیاری)</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="datetime-local" className={input} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        <select className={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="MANUAL">تلفنی/حضوری</option>
          <option value="WEBAPP">شبکه اجتماعی</option>
          <option value="VOICE">صوتی</option>
        </select>
        <button onClick={submit} className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-700 sm:col-span-2">
          ثبت نوبت دستی
        </button>
      </div>
    );
  }

  // ─── تعطیلات استثنایی ──────────────────────────────────────────────────
  function HolidaysView() {
    const [holidays, setHolidays] = useState<any[]>([]);
    const [date, setDate] = useState("");
    const [isClosed, setIsClosed] = useState(true);
    const [openTime, setOpenTime] = useState("10:00");
    const [closeTime, setCloseTime] = useState("16:00");
    const [reason, setReason] = useState("");
    const [branchId, setBranchId] = useState("");

    const load = useCallback(async () => {
      const r = await fetch(`${base}/holidays`);
      const d = await r.json();
      if (d.success) setHolidays(d.holidays);
    }, [base]);

    useEffect(() => {
      load();
    }, [load]);

    async function add() {
      if (!date) return setMsg({ ok: false, text: "تاریخ را انتخاب کنید" });
      const r = await api(`${base}/holidays`, "POST", {
        date,
        isClosed,
        openTime: isClosed ? undefined : openTime,
        closeTime: isClosed ? undefined : closeTime,
        reason: reason || undefined,
        branchId: branchId || undefined,
      });
      if (r) {
        setDate("");
        setReason("");
        load();
      }
    }

    async function remove(id: string) {
      await api(`${base}/holidays/${id}`, "DELETE");
      load();
    }

    return (
      <div>
        <p className="mb-3 text-sm text-neutral-500">
          برای تعطیلی کامل سالن در یک تاریخ، یا تغییر ساعت کاری آن روز (مثلاً تعطیلات نیمه‌وقت) از این بخش استفاده کنید.
        </p>
        <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={input} placeholder="دلیل (اختیاری)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">کل سالن</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-600">
            <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
            تعطیل کامل
          </label>
          {!isClosed && (
            <>
              <input type="time" className={input} value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              <input type="time" className={input} value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </>
          )}
          <button onClick={add} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">
            افزودن
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {holidays.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">تعطیلات استثنایی ثبت نشده است.</p>}
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
              <div>
                <div className="font-bold text-neutral-800" dir="ltr">{String(h.date).slice(0, 10)}</div>
                <div className="text-xs text-neutral-500">
                  {h.isClosed ? "تعطیل کامل" : `ساعت ${h.openTime} تا ${h.closeTime}`}
                  {h.branch?.name ? ` — ${h.branch.name}` : " — کل سالن"}
                  {h.reason ? ` (${h.reason})` : ""}
                </div>
              </div>
              <button onClick={() => remove(h.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── مشتریان (CRM) ─────────────────────────────────────────────────────
  function CustomersView() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [editName, setEditName] = useState("");

    const load = useCallback(async () => {
      const r = await fetch(`${base}/customers`);
      const d = await r.json();
      if (d.success) setCustomers(d.customers);
    }, [base]);

    useEffect(() => {
      load();
    }, [load]);

    async function save(phone: string) {
      await api(`${base}/customers`, "PATCH", { phone, name: editName || undefined, note: note || undefined });
      setEditing(null);
      load();
    }

    const filtered = customers.filter((c) =>
      !q || (c.name ?? "").includes(q) || c.phone.includes(q)
    );

    return (
      <div>
        <input className={input} placeholder="جستجو بر اساس نام یا شماره" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">مشتری‌ای یافت نشد.</p>}
          {filtered.map((c) => (
            <div key={c.phone} className="rounded-2xl border border-neutral-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-neutral-800">
                    {c.name ?? "مشتری"}{" "}
                    <span className="text-xs font-normal text-neutral-400" dir="ltr">{c.phone}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.visits} نوبت — {c.completed} مراجعه — {c.cancelled} لغو — {c.noShow} عدم حضور
                  </div>
                  <div className="text-xs text-neutral-500">
                    هزینه‌کرد: {Number(c.spend).toLocaleString("fa-IR")} تومان
                    {c.lastVisit ? ` — آخرین مراجعه: ${new Date(c.lastVisit).toLocaleDateString("fa-IR")}` : ""}
                  </div>
                  {c.note && <div className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">📝 {c.note}</div>}
                </div>
                <button
                  onClick={() => {
                    setEditing(editing === c.phone ? null : c.phone);
                    setNote(c.note ?? "");
                    setEditName(c.name ?? "");
                  }}
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                >
                  {editing === c.phone ? "بستن" : "یادداشت / نام"}
                </button>
              </div>
              {editing === c.phone && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input className={input} placeholder="نام نمایشی" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input className={input} placeholder="یادداشت مجاز (مثلاً حساسیت، رنگ موردعلاقه...)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button onClick={() => save(c.phone)} className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700">
                    ذخیره
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── ردیف خدمات با ویرایش/غیرفعال‌سازی ─────────────────────────────────
  function ServiceRow({ service }: { service: Service }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(service.name);
    const [durationMin, setDurationMin] = useState(service.durationMin);
    const [price, setPrice] = useState(service.price);

    async function save() {
      const r = await api(`${base}/services/${service.id}`, "PATCH", {
        name,
        durationMin: Number(durationMin),
        price: Number(price),
      });
      if (r) {
        setEditing(false);
        refreshServices();
      }
    }

    async function toggleActive() {
      await api(`${base}/services/${service.id}`, "PATCH", { isActive: !service.isActive });
      refreshServices();
    }

    return (
      <div className="rounded-2xl border border-neutral-200 px-4 py-3">
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} type="number" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
            <input className={input} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            <button onClick={save} className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700">ذخیره</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className={`font-bold ${service.isActive ? "text-neutral-800" : "text-neutral-400 line-through"}`}>{service.name}</div>
              <div className="text-xs text-neutral-500">
                {service.durationMin} دقیقه — {service.price.toLocaleString("fa-IR")} تومان
                {!service.isActive ? " — غیرفعال" : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200">ویرایش</button>
              <button onClick={toggleActive} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                {service.isActive ? "غیرفعال" : "فعال‌سازی"}
              </button>
              <button onClick={() => api(`${base}/services/${service.id}`, "DELETE").then(refreshServices)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                حذف
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── ردیف کارمند با برنامه کاری و خدمات ────────────────────────────────
  function StaffRow({ item }: { item: StaffItem }) {
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState(() => {
      const source = item.schedule ?? [];
      return Array.from({ length: 7 }, (_, day) => {
        const found = source.find((s) => s.day === day);
        return { day, open: found?.open ?? "09:00", close: found?.close ?? "21:00", isClosed: found?.isClosed ?? false };
      });
    });
    const [serviceIds, setServiceIds] = useState<string[]>(() => (item.services ?? []).map((s) => s.id));
    const [active, setActive] = useState(item.isActive);

    async function saveSchedule() {
      const r = await api(`${base}/staff/${item.id}`, "PATCH", { schedule: days });
      if (r) refreshStaff();
    }

    async function saveServices() {
      const r = await api(`${base}/staff/${item.id}`, "PATCH", { serviceIds });
      if (r) refreshStaff();
    }

    async function toggleActive() {
      const next = !active;
      const r = await api(`${base}/staff/${item.id}`, "PATCH", { isActive: next });
      if (r) {
        setActive(next);
        refreshStaff();
      }
    }

    const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

    return (
      <div className="rounded-2xl border border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className={`font-bold ${active ? "text-neutral-800" : "text-neutral-400"}`}>
              {item.name} {item.title ? <span className="text-xs text-pink-600">({item.title})</span> : null}
            </div>
            <div className="text-xs text-neutral-500">
              {item.role} — کمیسیون {item.commissionPercent}٪ — {item.specialties.join("، ")}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200">
              {open ? "بستن" : "برنامه و خدمات"}
            </button>
            <button onClick={toggleActive} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
              {active ? "غیرفعال" : "فعال‌سازی"}
            </button>
            <button onClick={() => api(`${base}/staff/${item.id}`, "DELETE").then(refreshStaff)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
              حذف
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-extrabold text-neutral-700">برنامه کاری هفتگی</h4>
              <div className="space-y-1.5">
                {days.map((d, i) => (
                  <div key={d.day} className="grid grid-cols-[70px_1fr_1fr_58px] items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500">{DAY_NAMES[i]}</span>
                    <input type="time" className={input} value={d.open} disabled={d.isClosed} onChange={(e) => setDays((prev) => prev.map((x) => (x.day === d.day ? { ...x, open: e.target.value } : x)))} />
                    <input type="time" className={input} value={d.close} disabled={d.isClosed} onChange={(e) => setDays((prev) => prev.map((x) => (x.day === d.day ? { ...x, close: e.target.value } : x)))} />
                    <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                      <input type="checkbox" checked={d.isClosed} onChange={(e) => setDays((prev) => prev.map((x) => (x.day === d.day ? { ...x, isClosed: e.target.checked } : x)))} />
                      تعطیل
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={saveSchedule} className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800">
                ذخیره برنامه
              </button>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-extrabold text-neutral-700">خدمات قابل ارائه</h4>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={serviceIds.includes(s.id)}
                      onChange={(e) =>
                        setServiceIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                      }
                    />
                    {s.name}
                  </label>
                ))}
                {services.length === 0 && <p className="text-xs text-neutral-400">ابتدا خدمت بسازید.</p>}
              </div>
              <button onClick={saveServices} className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800">
                ذخیره خدمات
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "services", label: "خدمات" },
    { id: "calendar", label: "تقویم نوبت" },
    { id: "staff", label: "کارکنان" },
    { id: "customers", label: "مشتریان" },
    { id: "holidays", label: "تعطیلات" },
    { id: "branches", label: "شعبه‌ها" },
    { id: "cash", label: "صندوق" },
    { id: "report", label: "گزارش عملکرد" },
    { id: "waitlist", label: "صف انتظار" },
    { id: "blocks", label: "مسدودسازی" },
    { id: "booking", label: "ثبت نوبت" },
  ];

  return (
    <div>
      {msg && (
        <p className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t.id ? "bg-pink-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {tab === "services" && (
          <>
            <ServiceForm />
            <div className="space-y-2">
              {services.map((s) => (
                <ServiceRow key={s.id} service={s} />
              ))}
            </div>
          </>
        )}

        {tab === "staff" && (
          <>
            <StaffForm />
            <div className="space-y-2">
              {staff.map((s) => (
                <StaffRow key={s.id} item={s} />
              ))}
            </div>
          </>
        )}

        {tab === "customers" && <CustomersView />}
        {tab === "holidays" && <HolidaysView />}

        {tab === "branches" && (
          <>
            <BranchForm />
            <div className="space-y-2">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                  <div>
                    <div className="font-bold text-neutral-800">{b.name}</div>
                    <div className="text-xs text-neutral-500">{b.city ?? ""} {b.address ?? ""}</div>
                  </div>
                  <button onClick={() => api(`${base}/branches/${b.id}`, "DELETE").then(refreshBranches)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              ))}
              {branches.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">هنوز شعبه‌ای نساخته‌اید.</p>}
            </div>
          </>
        )}

        {tab === "cash" && (
          <>
            <CashForm />
            <div className="mt-4 space-y-2">
              {cash.entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                  <div className="text-xs text-neutral-500">
                    {e.branch?.name ?? "کل سالن"} — {new Date(e.createdAt).toLocaleString("fa-IR")}
                    {e.note ? ` — ${e.note}` : ""}
                  </div>
                  <div className="text-xs font-bold text-neutral-700">
                    نقدی {e.cashAmount.toLocaleString("fa-IR")} — کارت {e.cardAmount.toLocaleString("fa-IR")} — آنلاین {e.onlineAmount.toLocaleString("fa-IR")}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "report" && <ReportView />}
        {tab === "waitlist" && <WaitlistView />}
        {tab === "calendar" && <CalendarView />}

        {tab === "blocks" && (
          <>
            <BlockForm />
            <div className="space-y-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                  <div>
                    <div className="font-bold text-neutral-800">{b.reason ?? "مسدودسازی"}</div>
                    <div className="text-xs text-neutral-500" dir="ltr">
                      {new Date(b.startAt).toLocaleString("fa-IR")} ← {new Date(b.endAt).toLocaleString("fa-IR")}
                      {b.staff ? ` — ${b.staff.name}` : ""}
                    </div>
                  </div>
                  <button onClick={() => api(`${base}/blocks/${b.id}`, "DELETE").then(refreshBlocks)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "booking" && <BookingForm />}
      </div>
    </div>
  );
}
