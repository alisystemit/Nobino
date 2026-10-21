"use client";

import { useCallback, useEffect, useState } from "react";

type Discount = { id: string; code: string; percent: number; maxUses: number; usedCount: number; isActive: boolean };
type Salon = { id: string; name: string; slug: string; owner: { phone: string } | null; isApproved: boolean; isActive: boolean };
type Audit = { id: string; action: string; entityType: string; actorPhone: string | null; createdAt: string };

export default function AdminExtras() {
  const [tab, setTab] = useState<"metrics" | "salons" | "subscriptions" | "users" | "packages" | "discounts" | "sms" | "audit">("metrics");

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
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

  const refreshAudits = useCallback(async () => {
    const r = await fetch("/api/admin/audit");
    const d = await r.json();
    if (d.success) setAudits(d.logs);
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
    return (
      <div className="space-y-2">
        {salons.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{s.name} <span className="text-xs text-neutral-400" dir="ltr">/{s.slug}</span></div>
              <div className="text-xs text-neutral-500">{s.owner?.phone ?? "—"}</div>
            </div>
            <div className="flex gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.isApproved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {s.isApproved ? "تأیید‌شده" : "در انتظار"}
              </span>
              <button onClick={async () => { await api(`/api/admin/salons/${s.id}/status`, "PATCH", { isApproved: !s.isApproved }); refreshSalons(); }} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-200">
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
    useEffect(() => {
      (async () => { const r = await fetch("/api/admin/users"); const d = await r.json(); if (d.success) setUsers(d.users); })();
    }, []);
    async function changeRole(id: string, role: string) {
      await api("/api/admin/users", "PATCH", { userId: id, role });
      const r = await fetch("/api/admin/users"); const d = await r.json(); if (d.success) setUsers(d.users);
    }
    return (
      <div className="space-y-2">
        {users.length === 0 && <p className="py-6 text-center text-neutral-400">کاربری یافت نشد.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{u.name ?? u.phone} <span className="text-xs text-neutral-400" dir="ltr">{u.phone}</span></div>
              <div className="text-xs text-neutral-500">امتیاز وفاداری: {u.loyaltyPoints}</div>
            </div>
            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-bold outline-none">
              {["CUSTOMER", "SALON_OWNER", "AGENT", "ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }

  function PackageManager() {
    const [pkgs, setPkgs] = useState<any[]>([]);
    useEffect(() => {
      (async () => { const r = await fetch("/api/admin/packages"); const d = await r.json(); if (d.success) setPkgs(d.packages); })();
    }, []);
    async function setPrice(id: string, price: number) {
      await api("/api/admin/packages", "PATCH", { id, price });
      const r = await fetch("/api/admin/packages"); const d = await r.json(); if (d.success) setPkgs(d.packages);
    }
    return (
      <div className="space-y-2">
        {pkgs.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-800">{p.name} <span className="text-xs text-neutral-400">({p.plan})</span></div>
              <div className="text-xs text-neutral-500">ماهانه: {p.price.toLocaleString("fa-IR")} — سالانه: {(p.yearlyPrice ?? p.price * 10).toLocaleString("fa-IR")}</div>
            </div>
            <input type="number" defaultValue={p.price} onBlur={(e) => setPrice(p.id, Number(e.target.value))} className="w-28 rounded-xl border border-neutral-300 px-3 py-1.5 text-xs outline-none" />
          </div>
        ))}
      </div>
    );
  }

  const tabs = [
    { id: "metrics", label: "درآمد SaaS" },
    { id: "salons", label: "سالن‌ها" },
    { id: "subscriptions", label: "اشتراک‌ها" },
    { id: "users", label: "کاربران" },
    { id: "packages", label: "پکیج‌ها" },
    { id: "discounts", label: "کد تخفیف" },
    { id: "sms", label: "تست پیامک" },
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
        {tab === "salons" && <SalonManagerList />}
        {tab === "subscriptions" && <SubscriptionManager />}
        {tab === "users" && <UserManager />}
        {tab === "packages" && <PackageManager />}
        {tab === "discounts" && <DiscountManager />}
        {tab === "sms" && <SmsTest />}
        {tab === "audit" && (
          <div className="space-y-2">
            {audits.length === 0 && <p className="py-8 text-center text-neutral-400">رویدادی ثبت نشده است.</p>}
            {audits.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                <div>
                  <div className="font-bold text-neutral-800">{a.action}</div>
                  <div className="text-xs text-neutral-500">{a.entityType} {a.actorPhone ?? ""}</div>
                </div>
                <div className="text-xs text-neutral-400">{new Date(a.createdAt).toLocaleString("fa-IR")}</div>
              </div>
            ))}
            <button onClick={refreshAudits} className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-200">بارگیری</button>
          </div>
        )}
      </div>
    </div>
  );
}
