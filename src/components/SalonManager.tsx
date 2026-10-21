"use client";

import { useCallback, useEffect, useState } from "react";
import RevenueChart from "@/components/RevenueChart";

type Service = { id: string; name: string; durationMin: number; price: number; description?: string | null; isActive: boolean };
type StaffItem = { id: string; name: string; title?: string | null; role: string; commissionPercent: number; branchId?: string | null; specialties: string[]; isActive: boolean };
type Block = { id: string; startAt: string; endAt: string; reason?: string | null; staff?: { name: string } | null };
type Branch = { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; isActive: boolean };
type CashEntry = { id: string; branch?: { name: string } | null; cashAmount: number; cardAmount: number; onlineAmount: number; expenseAmount: number; note?: string | null; createdAt: string };

type Tab = "services" | "staff" | "blocks" | "booking" | "branches" | "cash" | "report" | "waitlist" | "calendar";

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
    const [week, setWeek] = useState<string[]>([]);
    const [appts, setAppts] = useState<any[]>([]);
    const [staffFilter, setStaffFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    useEffect(() => {
      // هفته جاری (شروع از شنبه)
      const monday = new Date();
      const day = (monday.getDay() + 1) % 7; // شنبه=0
      monday.setDate(monday.getDate() - day);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      setWeek(days);
    }, []);

    useEffect(() => {
      (async () => {
        try {
          const res = await fetch("/api/appointments");
          const data = await res.json();
          if (data.success) setAppts(data.appointments);
        } catch {}
      })();
    }, []);

    const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
    const filtered = appts.filter((a) => {
      const d = a.startAt.slice(0, 10);
      if (!week.includes(d)) return false;
      if (staffFilter && a.employee !== staffFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });

    return (
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          <input className={input} placeholder="فیلتر آرایشگر" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} />
          <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {week.map((day, i) => {
            const dayAppts = filtered.filter((a) => a.startAt.slice(0, 10) === day).sort((a, b) => a.startAt.localeCompare(b.startAt));
            return (
              <div key={day} className="rounded-2xl border border-neutral-200 p-3">
                <div className="mb-2 text-sm font-extrabold text-neutral-800">{dayNames[i]} <span className="text-xs font-normal text-neutral-400" dir="ltr">{day}</span></div>
                <div className="space-y-1.5">
                  {dayAppts.length === 0 && <p className="text-xs text-neutral-400">نوبتی نیست</p>}
                  {dayAppts.map((a) => (
                    <div key={a.id} className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs">
                      <div className="font-bold text-neutral-700" dir="ltr">{a.startAt.slice(11, 16)}</div>
                      <div className="text-neutral-600">{a.customerName} {a.employee ? `— ${a.employee}` : ""}</div>
                      <div className="text-neutral-400">{a.service ?? ""} · {a.status}</div>
                    </div>
                  ))}
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "services", label: "خدمات" },
    { id: "calendar", label: "تقویم نوبت" },
    { id: "staff", label: "کارکنان" },
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
                <div key={s.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                  <div>
                    <div className="font-bold text-neutral-800">{s.name}</div>
                    <div className="text-xs text-neutral-500">{s.durationMin} دقیقه — {s.price.toLocaleString("fa-IR")} تومان</div>
                  </div>
                  <button onClick={() => api(`${base}/services/${s.id}`, "DELETE").then(refreshServices)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "staff" && (
          <>
            <StaffForm />
            <div className="space-y-2">
              {staff.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                  <div>
                    <div className="font-bold text-neutral-800">{s.name} {s.title ? <span className="text-xs text-pink-600">({s.title})</span> : null}</div>
                    <div className="text-xs text-neutral-500">
                      {s.role} — کمیسیون {s.commissionPercent}٪ — {s.specialties.join("، ")}
                    </div>
                  </div>
                  <button onClick={() => api(`${base}/staff/${s.id}`, "DELETE").then(refreshStaff)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

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
