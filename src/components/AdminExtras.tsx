"use client";

import { useCallback, useEffect, useState } from "react";

type Discount = { id: string; code: string; percent: number; maxUses: number; usedCount: number; isActive: boolean };
type Salon = { id: string; name: string; slug: string; owner: { phone: string } | null; isApproved: boolean; isActive: boolean };
type Audit = { id: string; action: string; entityType: string; actorPhone: string | null; createdAt: string };

export default function AdminExtras() {
  const [tab, setTab] = useState<"discounts" | "salons" | "audit" | "sms">("salons");

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

  const tabs = [
    { id: "salons", label: "سالن‌ها" },
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
        {tab === "salons" && <SalonManagerList />}
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
