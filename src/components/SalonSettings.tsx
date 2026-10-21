"use client";

import { useState } from "react";

type Salon = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  city: string | null;
  address: string | null;
  description: string | null;
  coverColor: string;
  isActive: boolean;
};

export default function SalonSettings({ salon }: { salon: Salon }) {
  const [form, setForm] = useState({
    name: salon.name,
    phone: salon.phone,
    city: salon.city ?? "",
    address: salon.address ?? "",
    description: salon.description ?? "",
    coverColor: salon.coverColor,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/salons/${salon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا در ذخیره");
      setMsg({ ok: true, text: "ذخیره شد ✅" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-neutral-500">نام سالن</label>
        <input className={input} value={form.name} onChange={set("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500">تلفن</label>
          <input className={input} dir="ltr" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">شهر</label>
          <input className={input} value={form.city} onChange={set("city")} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">آدرس</label>
        <input className={input} value={form.address} onChange={set("address")} />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">توضیحات</label>
        <textarea className={`${input} min-h-[90px]`} value={form.description} onChange={set("description")} />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">رنگ زمینه</label>
        <input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-neutral-300" value={form.coverColor} onChange={set("coverColor")} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </button>

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
