"use client";

import { useCallback, useEffect, useState } from "react";

type Service = { id: string; name: string; durationMin: number; price: number; description?: string | null; isActive: boolean };
type StaffItem = { id: string; name: string; title?: string | null; role: string; commissionPercent: number; branchId?: string | null; specialties: string[]; isActive: boolean };
type Block = { id: string; startAt: string; endAt: string; reason?: string | null; staff?: { name: string } | null };
type Branch = { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; isActive: boolean };
type CashEntry = { id: string; branch?: { name: string } | null; cashAmount: number; cardAmount: number; onlineAmount: number; expenseAmount: number; note?: string | null; createdAt: string };

type Tab = "services" | "staff" | "blocks" | "booking" | "branches" | "cash";

export default function SalonManager({ salonId }: { salonId: string }) {
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
    { id: "staff", label: "کارکنان" },
    { id: "branches", label: "شعبه‌ها" },
    { id: "cash", label: "صندوق" },
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
