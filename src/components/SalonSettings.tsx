"use client";

import { useEffect, useState } from "react";

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

type Hour = { id: string; dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export default function SalonSettings({ salon }: { salon: Salon }) {
  const [form, setForm] = useState({
    name: salon.name,
    phone: salon.phone,
    city: salon.city ?? "",
    address: salon.address ?? "",
    description: salon.description ?? "",
    coverColor: salon.coverColor,
    timezone: (salon as { timezone?: string }).timezone ?? "Asia/Tehran",
    latitude: (salon as { latitude?: number | null }).latitude ?? "",
    longitude: (salon as { longitude?: number | null }).longitude ?? "",
    customDomain: (salon as { customDomain?: string | null }).customDomain ?? "",
    minNoticeMinutes: 60,
    maxAdvanceDays: 30,
    cancelDeadlineHours: 24,
    bufferMinutes: 10,
  });
  const [hours, setHours] = useState<Hour[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/dashboard/salons/${salon.id}/hours`);
      const data = await res.json();
      if (data.success) setHours(data.hours);
    })();
  }, [salon.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function setHour(day: number, patch: Partial<Hour>) {
    setHours((hs) => hs.map((h) => (h.dayOfWeek === day ? { ...h, ...patch } : h)));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/salons/${salon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          city: form.city,
          address: form.address,
          description: form.description,
          coverColor: form.coverColor,
          timezone: form.timezone,
          latitude: form.latitude === "" ? null : Number(form.latitude),
          longitude: form.longitude === "" ? null : Number(form.longitude),
          customDomain: form.customDomain || null,
          minNoticeMinutes: Number(form.minNoticeMinutes),
          maxAdvanceDays: Number(form.maxAdvanceDays),
          cancelDeadlineHours: Number(form.cancelDeadlineHours),
          bufferMinutes: Number(form.bufferMinutes),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");

      if (hours.length > 0) {
        await fetch(`/api/dashboard/salons/${salon.id}/hours`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: hours.map((h) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed })) }),
        });
      }

      setMsg({ ok: true, text: "ذخیره شد ✅" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500";

  return (
    <div className="space-y-5">
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
        <textarea className={`${input} min-h-[80px]`} value={form.description} onChange={set("description")} />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">رنگ زمینه</label>
        <input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-neutral-300" value={form.coverColor} onChange={set("coverColor")} />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">منطقه زمانی</label>
        <input className={input} value={form.timezone} onChange={set("timezone")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500">عرض جغرافیایی</label>
          <input className={input} dir="ltr" value={form.latitude} onChange={set("latitude")} />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">طول جغرافیایی</label>
          <input className={input} dir="ltr" value={form.longitude} onChange={set("longitude")} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">دامنه اختصاصی (برای پلن سازمانی)</label>
        <input className={input} dir="ltr" placeholder="salon.com" value={form.customDomain} onChange={set("customDomain")} />
        <p className="mt-1 text-[11px] text-neutral-400">باید DNS دامنه به این سرویس اشاره کند.</p>
      </div>

      {/* قوانین رزرو */}
      <div className="rounded-2xl border border-neutral-200 p-4">
        <h3 className="text-sm font-extrabold text-neutral-800">قوانین رزرو</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-neutral-500">حداقل فاصله تا رزرو (دقیقه)</label>
            <input type="number" className={input} value={form.minNoticeMinutes} onChange={set("minNoticeMinutes")} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-neutral-500">حداکثر بازه آینده (روز)</label>
            <input type="number" className={input} value={form.maxAdvanceDays} onChange={set("maxAdvanceDays")} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-neutral-500">مهلت لغو (ساعت قبل از نوبت)</label>
            <input type="number" className={input} value={form.cancelDeadlineHours} onChange={set("cancelDeadlineHours")} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-neutral-500">بافر بین نوبت‌ها (دقیقه)</label>
            <input type="number" className={input} value={form.bufferMinutes} onChange={set("bufferMinutes")} />
          </div>
        </div>
      </div>

      {/* ساعات کاری */}
      <div className="rounded-2xl border border-neutral-200 p-4">
        <h3 className="text-sm font-extrabold text-neutral-800">ساعات کاری هفتگی</h3>
        <div className="mt-3 space-y-2">
          {hours.map((h) => (
            <div key={h.dayOfWeek} className="grid grid-cols-[80px_1fr_1fr_64px] items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">{DAY_NAMES[h.dayOfWeek]}</span>
              <input type="time" className={input} value={h.openTime} disabled={h.isClosed} onChange={(e) => setHour(h.dayOfWeek, { openTime: e.target.value })} />
              <input type="time" className={input} value={h.closeTime} disabled={h.isClosed} onChange={(e) => setHour(h.dayOfWeek, { closeTime: e.target.value })} />
              <label className="flex items-center gap-1 text-xs text-neutral-500">
                <input type="checkbox" checked={h.isClosed} onChange={(e) => setHour(h.dayOfWeek, { isClosed: e.target.checked })} />
                تعطیل
              </label>
            </div>
          ))}
        </div>
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
