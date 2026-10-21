"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateSalon() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", slug: "", phone: "", city: "", address: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/salons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500";

  return (
    <div className="space-y-4">
      <input className={input} placeholder="نام سالن" value={form.name} onChange={set("name")} />
      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="اسلاگ (latin)" dir="ltr" value={form.slug} onChange={set("slug")} />
        <input className={input} placeholder="تلفن" dir="ltr" value={form.phone} onChange={set("phone")} />
      </div>
      <input className={input} placeholder="شهر" value={form.city} onChange={set("city")} />
      <input className={input} placeholder="آدرس" value={form.address} onChange={set("address")} />
      <textarea className={`${input} min-h-[80px]`} placeholder="توضیحات درباره سالن" value={form.description} onChange={set("description")} />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={loading || !form.name || !form.slug || !form.phone}
        className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
      >
        {loading ? "در حال ساخت..." : "ساخت سالن"}
      </button>
    </div>
  );
}
