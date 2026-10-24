"use client";

import { useCallback, useEffect, useState } from "react";
import AdminCharts from "@/components/AdminCharts";

type Discount = { id: string; code: string; percent: number; maxUses: number; usedCount: number; isActive: boolean };
type Salon = { id: string; name: string; slug: string; owner: { phone: string } | null; isApproved: boolean; isActive: boolean };

export default function AdminExtras({ initialTab = "metrics" }: { initialTab?: string }) {
  const [tab, setTab] = useState<string>(initialTab);

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshSalons = useCallback(async () => {
    const r = await fetch("/api/salons");
    const d = await r.json();
    if (d.success) setSalons(d.salons);
  }, []);

  const refreshDiscounts = useCallback(async () => {
    const r = await fetch("/api/admin/discounts");
    const d = await r.json();
    if (d.success) setDiscounts(d.discounts);
  }, []);

  useEffect(() => {
    refreshSalons();
  }, [refreshSalons]);

  const input = "w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-pink-500";

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json();
    if (!d.success) setMsg({ ok: false, text: d.error || "خطا" });
    else setMsg({ ok: true, text: "ذخیره شد ✅" });
    return d;
  }

  function DiscountManager() {
    const [code, setCode] = useState("");
    const [percent, setPercent] = useState(10);
    return (
      <div>
        <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_120px_auto]">
          <input className={input} placeholder="کد (مثلاً NOBINO20)" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={input} type="number" placeholder="درصد" value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
          <button onClick={async () => { await api("/api/admin/discounts", "POST", { code, percent }); setCode(""); refreshDiscounts(); }} className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800">
            ساخت کد
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {discounts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
              <div>
                <div className="font-bold text-neutral-800" dir="ltr">{d.code}</div>
                <div className="text-xs text-neutral-500">{d.percent}٪ — استفاده‌شده {d.usedCount}/{d.maxUses || "∞"}</div>
              </div>
              <button onClick={async () => { await api(`/api/admin/discounts/${d.id}`, "DELETE"); refreshDiscounts(); }} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SalonManagerList() {
    const [detail, setDetail] = useState<any>(null);
    async function open(salonId: string) {
      const r = await fetch(`/api/admin/salons/${salonId}`);
      const d = await r.json();
      if (d.success) setDetail(d.salon);
      else setMsg({ ok: false, text: d.error || "خطا" });
    }
    return (
      <div className="space-y-2">
        {detail && (
          <div className="rounded-2xl border border-pink-200 bg-pink-50/50 p-4 dark:border-pink-800 dark:bg-pink-950/20">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-neutral-900 dark:text-neutral-100">{detail.name}</h4>
              <button onClick={() => setDetail(null)} className="rounded-lg bg-neutral-200 px-3 py-1 text-xs font-bold">بستن ✕</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["نوبت‌ها", detail._count.appointments],
                ["کارکنان", detail._count.staff],
                ["خدمات", detail._count.services],
                ["شعبه‌ها", detail._count.branches],
                ["نظرات", detail._count.reviews],
                ["سفارش‌ها", detail._count.orders],
                ["درآمد پرداخت‌شده", (detail.paidRevenue ?? 0).toLocaleString("fa-IR")],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-white px-3 py-2 text-center dark:bg-neutral-800">
                  <div className="text-sm font-black text-neutral-900 dark:text-neutral-100">{v}</div>
                  <div className="text-[11px] text-neutral-500">{l}</div>
                </div>
              ))}
            </div>
            {detail.subscription && (
              <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs dark:bg-neutral-800">
                اشتراک: <b>{detail.subscription.plan}</b> — تا {new Date(detail.subscription.endsAt).toLocaleDateString("fa-IR")}
              </div>
            )}
            <div className="mt-3 space-y-1">
              <div className="text-xs font-bold text-neutral-600 dark:text-neutral-300">آخرین نوبت‌ها</div>
              {(detail.recentAppointments ?? []).slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex justify-between rounded-lg bg-white px-3 py-1.5 text-xs dark:bg-neutral-800">
                  <span>{a.customerName}</span>
                  <span className="text-neutral-500">{new Date(a.startAt).toLocaleString("fa-IR")} — {a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {salons.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <button onClick={() => open(s.id)} className="text-right">
              <div className="font-bold text-neutral-800 dark:text-neutral-100">{s.name} <span className="text-xs text-neutral-400" dir="ltr">/{s.slug}</span></div>
              <div className="text-xs text-neutral-500">{s.owner?.phone ?? "—"}</div>
            </button>
            <div className="flex gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.isApproved ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40" : "bg-amber-50 text-amber-700 dark:bg-amber-900/40"}`}>
                {s.isApproved ? "تأیید‌شده" : "در انتظار"}
              </span>
              <button onClick={() => open(s.id)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                جزئیات
              </button>
              <button onClick={async () => { await api(`/api/admin/salons/${s.id}/status`, "PATCH", { isApproved: !s.isApproved }); refreshSalons(); }} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                {s.isApproved ? "لغو تأیید" : "تأیید"}
              </button>
              <button onClick={async () => { await api(`/api/admin/salons/${s.id}/status`, "PATCH", { isActive: !s.isActive }); refreshSalons(); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${s.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                {s.isActive ? "تعلیق" : "فعال‌سازی"}
              </button>
            </div>
          </div>
        ))}
        {salons.length === 0 && <p className="py-8 text-center text-neutral-400">سالنی یافت نشد.</p>}
      </div>
    );
  }

  function SmsTest() {
    const [provider, setProvider] = useState("kavenegar");
    const [phone, setPhone] = useState("");
    async function test() {
      const r = await api("/api/admin/sms/test", "POST", { provider, phone });
      if (r?.success) setMsg({ ok: true, text: r.message });
    }
    return (
      <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input className={input} placeholder="شماره موبایل برای تست" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <select className={input} value={provider} onChange={(e) => setProvider(e.target.value)}>
          {["kavenegar", "smsdotir", "farazsms", "ghasedak", "melipayamak", "iransms", "payamresan", "nakalaya", "mobilesms", "arpano"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button onClick={test} className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-700">ارسال تست</button>
      </div>
    );
  }

  function MetricsManager() {
    const [m, setM] = useState<any>(null);
    useEffect(() => {
      (async () => { const r = await fetch("/api/admin/saas-metrics"); const d = await r.json(); if (d.success) setM(d.metrics); })();
    }, []);
    if (!m) return <p className="py-6 text-center text-neutral-400">در حال محاسبه...</p>;
    const cards = [
      { label: "درآمد ماهانه تکرارشونده (MRR)", value: m.mrrLabel, icon: "📈" },
      { label: "مجموع درآمد", value: m.totalRevenueLabel, icon: "💵" },
      { label: "اشتراک فعال", value: String(m.activeSubscriptions), icon: "✅" },
      { label: "سالن تأییدشده", value: String(m.approvedSalons), icon: "🪞" },
      { label: "سالن‌های آزمایشی", value: String(m.trialSalons), icon: "🎁" },
      { label: "نرخ ریزش ۳۰ روزه", value: `${m.churnRate}٪`, icon: "📉" },
    ];
    return (
      <div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-2xl">{c.icon}</div>
              <div className="mt-2 text-xl font-black text-neutral-900">{c.value}</div>
              <div className="mt-1 text-xs text-neutral-500">{c.label}</div>
            </div>
          ))}
        </div>
        {m.planBreakdown?.length > 0 && (
          <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <h4 className="text-sm font-extrabold text-neutral-800">توزیع پلن سالن‌ها</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.planBreakdown.map((p: any) => (
                <span key={p.plan} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                  {p.plan}: {p.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function ReviewManager() {
    const [reviews, setReviews] = useState<any[]>([]);
    useEffect(() => {
      (async () => { const r = await fetch("/api/admin/reviews"); const d = await r.json(); if (d.success) setReviews(d.reviews); })();
    }, []);
    async function remove(id: string) {
      await api("/api/admin/reviews", "DELETE", { id });
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
    return (
      <div className="space-y-2">
        {reviews.length === 0 && <p className="py-6 text-center text-neutral-400">نظری ثبت نشده است.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{r.salon?.name} — ★ {r.rating}</div>
              <div className="text-xs text-neutral-500">{r.customer?.name ?? r.customer?.phone}{r.staff ? ` — ${r.staff.name}` : ""}</div>
              {r.comment && <div className="mt-1 text-sm text-neutral-600">{r.comment}</div>}
            </div>
            <button onClick={() => remove(r.id)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
              حذف نظر
            </button>
          </div>
        ))}
      </div>
    );
  }

  function AuditView() {
    const [logs, setLogs] = useState<any[]>([]);
    const [action, setAction] = useState("");
    const [entity, setEntity] = useState("");
    async function load() {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      const r = await fetch(`/api/admin/audit?${params}`);
      const d = await r.json();
      if (d.success) setLogs(d.logs);
    }
    useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={input} placeholder="اقدام (مثلاً approve_salon)" value={action} onChange={(e) => setAction(e.target.value)} />
          <input className={input} placeholder="نوع موجودیت (Salon/User)" value={entity} onChange={(e) => setEntity(e.target.value)} />
          <button onClick={load} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">فیلتر</button>
        </div>
        <div className="space-y-2">
          {logs.length === 0 && <p className="py-8 text-center text-neutral-400">رویدادی یافت نشد.</p>}
          {logs.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div>
                <div className="font-bold text-neutral-800 dark:text-neutral-100">{a.action}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{a.entityType} — {a.actorPhone ?? "سیستم"}</div>
              </div>
              <div className="text-xs text-neutral-400">{new Date(a.createdAt).toLocaleString("fa-IR")}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function BroadcastView() {
    const [message, setMessage] = useState("");
    const [audience, setAudience] = useState("ALL_SALONS");
    const [sending, setSending] = useState(false);
    async function send() {
      if (!message.trim()) return;
      setSending(true);
      const d = await api("/api/admin/broadcast", "POST", { message, audience });
      if (d.success) {
        setMsg({ ok: true, text: `پیامک به ${d.queued} شماره در صف قرار گرفت ✅` });
        setMessage("");
      }
      setSending(false);
    }
    return (
      <div className="rounded-2xl border border-neutral-200 p-4">
        <h4 className="text-sm font-extrabold text-neutral-800">پخش پیامک سراسری</h4>
        <textarea className={`${input} mt-3 min-h-[90px]`} placeholder="متن پیامک..." value={message} onChange={(e) => setMessage(e.target.value)} />
        <select className={`${input} mt-3`} value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="ALL_SALONS">همه سالن‌ها (فعال)</option>
          <option value="SALON_OWNERS">همه مالکان سالن</option>
          <option value="ACTIVE_SUBS">مشترکین فعال</option>
        </select>
        <button onClick={send} disabled={sending || !message.trim()} className="mt-3 w-full rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 py-3 font-black text-white shadow-lg disabled:opacity-50">
          {sending ? "در حال ارسال..." : "ارسال پیامک سراسری"}
        </button>
      </div>
    );
  }

  function SubscriptionManager() {
    const [subs, setSubs] = useState<any[]>([]);
    useEffect(() => {
      (async () => { const r = await fetch("/api/admin/subscriptions"); const d = await r.json(); if (d.success) setSubs(d.subscriptions); })();
    }, []);
    async function setStatus(id: string, status: string) {
      await api("/api/admin/subscriptions", "PATCH", { subscriptionId: id, status });
      const r = await fetch("/api/admin/subscriptions"); const d = await r.json(); if (d.success) setSubs(d.subscriptions);
    }
    return (
      <div className="space-y-2">
        {subs.length === 0 && <p className="py-6 text-center text-neutral-400">اشتراکی ثبت نشده است.</p>}
        {subs.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{s.salon?.name} <span className="text-xs text-neutral-400">({s.package?.name})</span></div>
              <div className="text-xs text-neutral-500" dir="ltr">{new Date(s.endsAt).toLocaleDateString("fa-IR")} — {s.period}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : s.status === "EXPIRED" ? "bg-neutral-100 text-neutral-500" : "bg-red-50 text-red-600"}`}>
                {s.status}
              </span>
              {s.status === "ACTIVE" && (
                <button onClick={() => setStatus(s.id, "CANCELLED")} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                  لغو
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function UserManager() {
    const [users, setUsers] = useState<any[]>([]);
    const [q, setQ] = useState("");
    async function load() {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d.success) setUsers(d.users);
    }
    useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function changeRole(id: string, role: string) {
      await api("/api/admin/users", "PATCH", { userId: id, role });
      load();
    }
    async function toggleActive(u: any) {
      await api("/api/admin/users", "PATCH", { userId: u.id, isActive: !u.isActive });
      load();
    }
    return (
      <div>
        <div className="mb-3 flex gap-2">
          <input className={input} placeholder="جستجوی موبایل/نام/ایمیل..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={load} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800">جستجو</button>
        </div>
        <div className="space-y-2">
          {users.length === 0 && <p className="py-6 text-center text-neutral-400">کاربری یافت نشد.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div>
                <div className="font-bold text-neutral-800 dark:text-neutral-100">{u.name ?? u.phone} <span className="text-xs text-neutral-400" dir="ltr">{u.phone}</span></div>
                <div className="text-xs text-neutral-500">امتیاز: {u.loyaltyPoints} — {u.email ?? ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-bold outline-none dark:border-neutral-700 dark:bg-neutral-800">
                  {["CUSTOMER", "SALON_OWNER", "AGENT", "ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => toggleActive(u)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${u.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                >
                  {u.isActive ? "تعلیق" : "فعال"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function PackageManager() {
    const [pkgs, setPkgs] = useState<any[]>([]);
    const [editing, setEditing] = useState<any>(null);

    async function load() {
      const r = await fetch("/api/admin/packages");
      const d = await r.json();
      if (d.success) setPkgs(d.packages);
    }
    useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function save() {
      if (!editing) return;
      const d = await api("/api/admin/packages", editing.id ? "PATCH" : "POST", editing);
      if (d.success) { setEditing(null); load(); }
    }

    function addFeature() {
      setEditing((e: any) => ({ ...e, features: [...(e.features ?? []), ""] }));
    }
    function setFeature(i: number, v: string) {
      setEditing((e: any) => { const f = [...(e.features ?? [])]; f[i] = v; return { ...e, features: f }; });
    }
    function removeFeature(i: number) {
      setEditing((e: any) => ({ ...e, features: (e.features ?? []).filter((_: string, idx: number) => idx !== i) }));
    }

    const numCls = "w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-pink-500";

    return (
      <div>
        <button onClick={() => setEditing({ id: null, name: "", plan: "BASIC", price: 0, yearlyPrice: null, durationDays: 30, features: [] })} className="mb-4 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 px-4 py-2 text-sm font-black text-white shadow-lg">
          + پکیج جدید
        </button>

        {editing && (
          <div className="mb-4 rounded-2xl border border-pink-200 bg-pink-50/50 p-4 dark:border-pink-800 dark:bg-pink-950/20">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={numCls} placeholder="نام پکیج" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select className={numCls} value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}>
                {["FREE", "BASIC", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className={numCls} type="number" placeholder="قیمت ماهانه (تومان)" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              <input className={numCls} type="number" placeholder="قیمت سالانه (اختیاری)" value={editing.yearlyPrice ?? ""} onChange={(e) => setEditing({ ...editing, yearlyPrice: e.target.value === "" ? null : Number(e.target.value) })} />
              <input className={numCls} type="number" placeholder="مدت (روز)" value={editing.durationDays} onChange={(e) => setEditing({ ...editing, durationDays: Number(e.target.value) })} />
            </div>
            <div className="mt-3">
              <div className="mb-1 text-xs font-bold text-neutral-600">ماژول‌ها / ویژگی‌ها</div>
              {(editing.features ?? []).map((f: string, i: number) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input className={numCls} value={f} onChange={(e) => setFeature(i, e.target.value)} placeholder={`ویژگی ${i + 1}`} />
                  <button onClick={() => removeFeature(i)} className="rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100">حذف</button>
                </div>
              ))}
              <button onClick={addFeature} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200">+ افزودن ماژول</button>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={save} className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-800">ذخیره</button>
              <button onClick={() => setEditing(null)} className="rounded-xl bg-neutral-200 px-5 py-2 text-sm font-bold text-neutral-700">انصراف</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {pkgs.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div>
                <div className="font-bold text-neutral-800 dark:text-neutral-100">{p.name} <span className="text-xs text-neutral-400">({p.plan})</span></div>
                <div className="text-xs text-neutral-500">ماهانه: {p.price.toLocaleString("fa-IR")} — سالانه: {(p.yearlyPrice ?? p.price * 10).toLocaleString("fa-IR")} — {p.features?.length ?? 0} ماژول</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing({ id: p.id, name: p.name, plan: p.plan, price: p.price, yearlyPrice: p.yearlyPrice, durationDays: p.durationDays, features: p.features ?? [], isActive: p.isActive })} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                  ویرایش
                </button>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  <input type="checkbox" checked={p.isActive} onChange={async (e) => { await api("/api/admin/packages", "PATCH", { id: p.id, isActive: e.target.checked }); load(); }} />
                  فعال
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SupportManager() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [summary, setSummary] = useState<Record<string, number>>({ OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 });
    const [statusFilter, setStatusFilter] = useState("");
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/admin/support?${params}`);
      const d = await r.json();
      if (d.success) {
        setTickets(d.tickets);
        setSummary(d.summary);
      }
    }, [statusFilter]);

    useEffect(() => {
      load();
    }, [load]);

    async function update(id: string, patch: Record<string, unknown>) {
      const d = await api("/api/admin/support", "PATCH", { id, ...patch });
      if (d.success) load();
    }

    return (
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { value: "", label: "همه" },
            { value: "OPEN", label: `باز (${summary.OPEN ?? 0})` },
            { value: "IN_PROGRESS", label: `در بررسی (${summary.IN_PROGRESS ?? 0})` },
            { value: "CLOSED", label: `بسته (${summary.CLOSED ?? 0})` },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                statusFilter === f.value ? "bg-pink-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tickets.length === 0 && <p className="py-8 text-center text-neutral-400">درخواستی یافت نشد.</p>}
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-neutral-800 dark:text-neutral-100">{t.subject}</div>
                  <div className="text-xs text-neutral-500">
                    {t.user?.name ?? t.name} — <span dir="ltr">{t.phone || t.email || t.user?.phone}</span> — {t.category}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    t.status === "OPEN" ? "bg-amber-50 text-amber-700" : t.status === "IN_PROGRESS" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {t.status === "OPEN" ? "باز" : t.status === "IN_PROGRESS" ? "در بررسی" : "بسته"}
                  </span>
                  {t.status !== "IN_PROGRESS" && (
                    <button onClick={() => update(t.id, { status: "IN_PROGRESS" })} className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100">
                      در بررسی
                    </button>
                  )}
                  {t.status !== "CLOSED" && (
                    <button onClick={() => update(t.id, { status: "CLOSED" })} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      بستن
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{t.message}</p>
              {t.adminReply && (
                <div className="mt-2 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                  <span className="text-xs font-bold text-neutral-500">پاسخ فعلی: </span>
                  <span className="whitespace-pre-wrap">{t.adminReply}</span>
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <textarea
                  className={`${input} min-h-[64px] flex-1`}
                  placeholder="پاسخ به کاربر..."
                  value={drafts[t.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                />
                <button
                  onClick={async () => {
                    const reply = (drafts[t.id] ?? "").trim();
                    if (!reply) return setMsg({ ok: false, text: "متن پاسخ خالی است" });
                    await update(t.id, { adminReply: reply, status: "CLOSED" });
                    setDrafts((prev) => ({ ...prev, [t.id]: "" }));
                  }}
                  className="rounded-xl bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700"
                >
                  ارسال پاسخ
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function NotificationReport() {
    const [data, setData] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState("");
    const [channelFilter, setChannelFilter] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      const r = await fetch(`/api/admin/notifications?${params}`);
      const d = await r.json();
      if (d.success) setData(d);
      else setMsg({ ok: false, text: d.error || "خطا" });
    }, [statusFilter, channelFilter]);

    useEffect(() => {
      load();
    }, [load]);

    async function retry(id?: string) {
      setBusy(true);
      const d = await api("/api/admin/notifications", "POST", id ? { id } : {});
      if (d.success) {
        setMsg({ ok: true, text: `${d.reset ?? 0} اعلان برای تلاش مجدد بازنشانی شد.` });
        load();
      }
      setBusy(false);
    }

    if (!data) return <p className="py-6 text-center text-neutral-400">در حال بارگیری...</p>;
    const s = data.summary;
    const cards = [
      { label: "در صف", value: s.PENDING ?? 0, icon: "⏳" },
      { label: "ارسال‌شده", value: s.SENT ?? 0, icon: "✅" },
      { label: "ناموفق", value: s.FAILED ?? 0, icon: "⚠️" },
      { label: "حذف‌شده", value: s.DROPPED ?? 0, icon: "🗑" },
      { label: "هزینه تخمینی (تومان)", value: (s.estimatedCost ?? 0).toLocaleString("fa-IR"), icon: "💸" },
    ];

    return (
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="text-xl">{c.icon}</div>
              <div className="mt-1 text-lg font-black text-neutral-900 dark:text-neutral-100">{c.value}</div>
              <div className="text-xs text-neutral-500">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="وضعیت">
            <option value="">همه وضعیت‌ها</option>
            <option value="PENDING">در صف</option>
            <option value="SENT">ارسال‌شده</option>
            <option value="FAILED">ناموفق</option>
            <option value="DROPPED">حذف‌شده</option>
          </select>
          <select className={input} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} aria-label="کانال">
            <option value="">همه کانال‌ها</option>
            <option value="SMS">پیامک</option>
            <option value="EMAIL">ایمیل</option>
            <option value="IN_APP">درون‌برنامه‌ای</option>
          </select>
          <button onClick={() => retry()} disabled={busy} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50">
            {busy ? "در حال تلاش..." : "تلاش مجدد برای همه ناموفق‌ها"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {data.notifications.length === 0 && <p className="py-8 text-center text-neutral-400">اعلانی یافت نشد.</p>}
          {data.notifications.map((n: any) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-neutral-800 dark:text-neutral-100">{n.type}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{n.channel}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{n.status}</span>
                  {n.attempts > 0 && <span className="text-[11px] text-neutral-400">تلاش: {n.attempts}</span>}
                </div>
                <div className="mt-1 text-xs text-neutral-500" dir="ltr">{n.recipient}</div>
                {n.lastError && <div className="mt-1 text-xs text-red-500">{String(n.lastError).slice(0, 160)}</div>}
                <div className="text-[11px] text-neutral-400">{new Date(n.createdAt).toLocaleString("fa-IR")}</div>
              </div>
              {(n.status === "FAILED" || n.status === "DROPPED") && (
                <button onClick={() => retry(n.id)} disabled={busy} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                  تلاش مجدد
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "metrics", label: "درآمد SaaS" },
    { id: "support", label: "پشتیبانی" },
    { id: "notifications", label: "گزارش پیامک" },
    { id: "charts", label: "نمودارها" },
    { id: "salons", label: "سالن‌ها" },
    { id: "reviews", label: "نظرات" },
    { id: "subscriptions", label: "اشتراک‌ها" },
    { id: "users", label: "کاربران" },
    { id: "packages", label: "پکیج‌ها" },
    { id: "discounts", label: "کد تخفیف" },
    { id: "sms", label: "تست پیامک" },
    { id: "broadcast", label: "پخش پیامک" },
    { id: "audit", label: "لاگ حسابرسی" },
  ] as const;

  return (
    <div>
      {msg && <p className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t.id ? "bg-pink-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "metrics" && <MetricsManager />}
        {tab === "support" && <SupportManager />}
        {tab === "notifications" && <NotificationReport />}
        {tab === "charts" && <AdminCharts />}
        {tab === "salons" && <SalonManagerList />}
        {tab === "reviews" && <ReviewManager />}
        {tab === "subscriptions" && <SubscriptionManager />}
        {tab === "users" && <UserManager />}
        {tab === "packages" && <PackageManager />}
        {tab === "discounts" && <DiscountManager />}
        {tab === "sms" && <SmsTest />}
        {tab === "broadcast" && <BroadcastView />}
        {tab === "audit" && <AuditView />}
      </div>
    </div>
  );
}
