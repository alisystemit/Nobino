"use client";

import { useCallback, useEffect, useState } from "react";

type Service = { id: string; name: string; durationMin: number; price: number; description?: string | null; isActive: boolean };
type StaffItem = { id: string; name: string; title?: string | null; specialties: string[]; isActive: boolean };
type Block = { id: string; startAt: string; endAt: string; reason?: string | null; staff?: { name: string } | null };

type Tab = "services" | "staff" | "blocks" | "booking";

export default function SalonManager({ salonId }: { salonId: string }) {
  const [tab, setTab] = useState<Tab>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
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

  useEffect(() => {
    refreshServices();
    refreshStaff();
    refreshBlocks();
  }, [refreshServices, refreshStaff, refreshBlocks]);

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
    const [specialties, setSpecialties] = useState("");
    async function submit() {
      await api(`${base}/staff`, "POST", {
        name,
        title: title || undefined,
        specialties: specialties.split("،").map((s) => s.trim()).filter(Boolean),
      });
      refreshStaff();
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input className={input} placeholder="نام آرایشگر" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="سمت (مثلاً ارشد)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} placeholder="تخصص‌ها (با ویرگول)" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
        <button onClick={submit} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">افزودن</button>
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
    { id: "staff", label: "کارکنان" },
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
                    <div className="text-xs text-neutral-500">{s.specialties.join("، ")}</div>
                  </div>
                  <button onClick={() => api(`${base}/staff/${s.id}`, "DELETE").then(refreshStaff)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

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
