"use client";

import { useEffect, useRef, useState } from "react";

type Service = { id: string; name: string; durationMin: number; price: number };
type Staff = { id: string; name: string; title?: string | null };
type Branch = { id: string; name: string };
type Extracted = { name?: string; phone?: string; service?: string; time?: string; note?: string };

/**
 * رزرو صوتی برای ادمین/آرایشگر داخل پنل.
 * ضبط صدا → transcribe → پیش‌پرکردن فرم → ثبت نوبت (channel=VOICE).
 */
export default function AdminVoiceBooking({ salonId, salonSlug }: { salonId: string; salonSlug: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    (async () => {
      const [s, st, b] = await Promise.all([
        fetch(`/api/dashboard/salons/${salonId}/services`).then((r) => r.json()),
        fetch(`/api/dashboard/salons/${salonId}/staff`).then((r) => r.json()),
        fetch(`/api/dashboard/salons/${salonId}/branches`).then((r) => r.json()),
      ]);
      if (s.success) setServices(s.services);
      if (st.success) setStaff(st.staff);
      if (b.success) setBranches(b.branches);
    })();
  }, [salonId]);

  function start() {
    setMsg(null);
    setTranscript("");
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => transcribe();
      mr.start();
      recRef.current = mr;
      setRecording(true);
    }).catch(() => setMsg({ ok: false, text: "دسترسی به میکروفون ممکن نیست." }));
  }
  function stop() {
    recRef.current?.stop();
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  async function transcribe() {
    setProcessing(true);
    const form = new FormData();
    form.append("audio", new Blob(chunksRef.current, { type: "audio/webm" }), "rec.webm");
    form.append("salonId", salonId);
    form.append("phone", phone);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      setTranscript(data.transcript);
      const ex: Extracted = data.extracted ?? {};
      if (ex.name) setName(ex.name);
      if (ex.phone) setPhone(ex.phone);
      if (ex.time) setTime(ex.time);
      if (ex.service) {
        const m = services.find((x) => ex.service && x.name.includes(ex.service!));
        if (m) setServiceId(m.id);
      }
      setMsg({ ok: true, text: "متن استخراج شد؛ اطلاعات را بررسی و در صورت نیاز ویرایش کنید." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setProcessing(false);
    }
  }

  async function submit() {
    if (!name || !phone || !date || !time) return setMsg({ ok: false, text: "نام، شماره، تاریخ و ساعت الزامی است." });
    setProcessing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonId,
          serviceId: serviceId || undefined,
          employeeId: employeeId || undefined,
          branchId: branchId || undefined,
          customerName: name,
          customerPhone: phone,
          startAt: new Date(`${date}T${time}:00`).toISOString(),
          channel: "VOICE",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا در ثبت");
      setMsg({ ok: true, text: "✅ نوبت ثبت شد." });
      setName(""); setPhone(""); setTime(""); setServiceId("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setProcessing(false);
    }
  }

  const input = "w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-sm outline-none focus:border-pink-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ضبط صوتی */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">🎙️ رزرو صوتی</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">دکمه را نگه‌دارید و بگویید: «برای فردا ساعت ۱۰، کوتاهی مو برای سارا، شماره ۰۹۱۲...»</p>
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={recording ? stop : start}
            disabled={processing}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-2xl text-white shadow-lg shadow-pink-500/30 transition hover:scale-105 disabled:opacity-50"
          >
            {recording && <span className="absolute inset-0 rounded-full bg-pink-500 animate-ping-slow" />}
            <span className="relative">{recording ? "⏹️" : "🎤"}</span>
          </button>
          <div className="text-sm text-neutral-500">
            {recording ? "در حال ضبط... برای پایان بزنید" : processing ? "در حال پردازش..." : "برای ضبط کلیک کنید"}
          </div>
        </div>
        {transcript && (
          <div className="mt-4 rounded-2xl bg-pink-50 p-4 text-sm leading-relaxed text-pink-900 dark:bg-pink-950/30 dark:text-pink-200">
            “{transcript}”
          </div>
        )}
      </div>

      {/* فرم */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">جزئیات نوبت</h3>
        <div className="mt-4 space-y-3">
          <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">خدمت</option>
            {services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          {staff.length > 0 && (
            <select className={input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">آرایشگر (اختیاری)</option>
              {staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          {branches.length > 1 && (
            <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">شعبه</option>
              {branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <input className={input} placeholder="نام مشتری" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={`${input} text-center`} dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <button onClick={submit} disabled={processing} className="w-full rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 py-3 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.01] disabled:opacity-50">
            {processing ? "در حال ثبت..." : "ثبت نوبت صوتی"}
          </button>
          {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"}`}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
}
