"use client";

import { useEffect, useMemo, useState } from "react";
import { KEEP_SECRET } from "@/lib/markers";

type Field = { key: string; label: string; type: "secret" | "string" | "number"; placeholder?: string };
type Provider = { id: string; name: string; description: string; fields: Field[] };
type SettingRow = { key: string; group: string; type: string; options?: string[]; description?: string; isSecret: boolean; hasValue: boolean; value: string };

const groupLabels: Record<string, string> = {
  sms: "📲 سرویس‌های پیامک",
  payments: "🏦 درگاه‌های پرداخت",
  voice: "🎙️ هوش صوتی",
  general: "⚙️ عمومی",
};

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProvider, setActiveProvider] = useState("");
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "دسترسی غیرمجاز");
        setProviders(data.smsProviders);
        setActiveProvider(data.activeSmsProvider);
        setRows(data.settings);
        const init: Record<string, string> = {};
        for (const s of data.settings) init[s.key] = s.value;
        setForm(init);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nonSms = useMemo(() => rows.filter((r) => r.group !== "sms"), [rows]);
  const smsKeys = useMemo(() => new Set(rows.filter((r) => r.group === "sms").map((r) => r.key)), [rows]);

  function setv(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const updates: { key: string; value: string }[] = [];
    for (const r of rows) {
      if (r.group === "sms" && ![...smsKeys].some(() => true)) continue;
      const v = form[r.key] ?? "";
      updates.push({ key: r.key, value: v });
    }
    updates.push({ key: "sms.active_provider", value: activeProvider });

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا در ذخیره");
      setMsg({ ok: true, text: "تنظیمات ذخیره شد ✅" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-10 text-center text-neutral-400">در حال بارگیری تنظیمات...</div>;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-red-600">{error}</div>;

  const inputCls = "w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-pink-500";

  return (
    <div className="space-y-8">
      {/* سرویس‌های پیامک */}
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-neutral-900">سرویس‌های پیامک</h2>
        <p className="mt-1 text-sm text-neutral-500">
          سرویس فعال را انتخاب و کلیدهای آن را وارد کنید. بیش از ۱۰ سرویس‌دهنده ایرانی پشتیبانی می‌شود.
        </p>

        <div className="mt-5">
          <label className="text-xs font-medium text-neutral-500">سرویس فعال</label>
          <select value={activeProvider} onChange={(e) => setActiveProvider(e.target.value)} className={`${inputCls} mt-1`}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {providers.map((p) => {
            const active = p.id === activeProvider;
            const allSet = p.fields.every((f) => {
              const v = form[`sms.${p.id}.${f.key}`] ?? "";
              return v && v !== KEEP_SECRET;
            });
            return (
              <div key={p.id} className={`rounded-2xl border p-4 ${active ? "border-pink-400 bg-pink-50/40" : "border-neutral-200"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-neutral-800">{p.name}</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${allSet ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {allSet ? "تنظیم شده" : "ناقص"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{p.description}</p>
                <div className="mt-3 space-y-2">
                  {p.fields.map((f) => {
                    const key = `sms.${p.id}.${f.key}`;
                    const isSecret = f.type === "secret";
                    const val = form[key] ?? "";
                    return (
                      <div key={key}>
                        <label className="text-[11px] font-medium text-neutral-400">{f.label}</label>
                        <input
                          type={isSecret && val === KEEP_SECRET ? "password" : "text"}
                          placeholder={isSecret && val === KEEP_SECRET ? "•••••••• (بدون تغییر)" : f.placeholder ?? ""}
                          value={isSecret && val === KEEP_SECRET ? "" : val}
                          onChange={(e) => setv(key, e.target.value)}
                          className={`${inputCls} mt-0.5`}
                        />
                      </div>
                    );
                  })}
                </div>
                {!active && (
                  <button onClick={() => setActiveProvider(p.id)} className="mt-3 text-xs font-semibold text-pink-600 hover:underline">
                    انتخاب به‌عنوان سرویس فعال
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* سایر تنظیمات */}
      {nonSms.length > 0 && (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-neutral-900">سایر تنظیمات سیستم</h2>
          <div className="mt-5 space-y-6">
            {Array.from(new Set(nonSms.map((r) => r.group))).map((group) => (
              <div key={group}>
                <h3 className="mb-3 text-sm font-bold text-neutral-600">{groupLabels[group] ?? group}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {nonSms
                    .filter((r) => r.group === group)
                    .map((r) => (
                      <div key={r.key}>
                        <label className="text-xs font-medium text-neutral-500">{r.description ?? r.key}</label>
                        {r.type === "select" && r.options ? (
                          <select value={form[r.key] ?? ""} onChange={(e) => setv(r.key, e.target.value)} className={`${inputCls} mt-1`}>
                            {r.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={r.type === "secret" && form[r.key] === KEEP_SECRET ? "password" : "text"}
                            value={r.type === "secret" && form[r.key] === KEEP_SECRET ? "" : form[r.key] ?? ""}
                            onChange={(e) => setv(r.key, e.target.value)}
                            placeholder={r.type === "secret" && form[r.key] === KEEP_SECRET ? "•••••••• (بدون تغییر)" : ""}
                            className={`${inputCls} mt-1`}
                          />
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {msg && (
        <p className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
      </button>
    </div>
  );
}
