"use client";

import { useRef, useState } from "react";

type Service = { id: string; name: string; durationMin: number; price: number };
type Extracted = { name?: string; phone?: string; service?: string; time?: string; note?: string };

export default function SalonBooking({ salonId, services }: { salonId: string; services: Service[] }) {
  const [serviceId, setServiceId] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [canning, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setMsg(null);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => sendAudio();
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setMsg({ ok: false, text: "دسترسی به میکروفون ممکن نیست." });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  async function sendAudio() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("salonId", salonId);
    form.append("phone", phone);

    setSending(true);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا در پردازش صدا");

      setTranscript(data.transcript);
      const ex: Extracted = data.extracted ?? {};
      if (ex.name) setName(ex.name);
      if (ex.phone) setPhone(ex.phone);
      if (ex.service) {
        const matched = services.find((s) => ex.service && s.name.includes(ex.service!));
        if (matched) setServiceId(matched.id);
      }
      if (ex.time) setTime(ex.time);
      setMsg({ ok: true, text: "متن شما استخراج شد. لطفاً اطلاعات را بررسی کنید." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!name || !phone || !date || !time) {
      return setMsg({ ok: false, text: "لطفاً همه فیلدها را پر کنید." });
    }
    setSending(true);
    setMsg(null);
    const startAt = new Date(`${date}T${time}:00`).toISOString();
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonId, serviceId: serviceId || undefined, customerName: name, customerPhone: phone, startAt, channel: "MANUAL" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "ثبت نوبت ناموفق بود");
      setMsg({ ok: true, text: "نوبت شما ثبت شد. پیامک تأیید ارسال خواهد شد." });
      setName(""); setPhone(""); setDate(""); setTime(""); setServiceId("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg">
      <h3 className="text-lg font-extrabold text-neutral-900">رزرو نوبت</h3>

      {/* Voice AI */}
      <div className="mt-5 rounded-2xl bg-gradient-to-bl from-pink-50 to-purple-50 p-4">
        <p className="text-sm font-bold text-neutral-700">🎙️ نوبت‌دهی با صدا</p>
        <p className="mt-1 text-xs text-neutral-500">میکروفون را بزنید و با صدای فارسی بگویید که چه زمانی برای چه خدمتی نوبت می‌خواهید.</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={canning}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-pink-600 text-white transition hover:bg-pink-700 disabled:opacity-50"
          >
            {recording && <span className="absolute inset-0 rounded-full bg-pink-500 animate-ping-slow" />}
            <span className="relative text-xl">{recording ? "⏹️" : "🎤"}</span>
          </button>
          <div className="text-xs text-neutral-500">
            {recording ? "در حال ضبط... برای پایان کلیک کنید" : canning ? "در حال پردازش..." : "برای شروع کلیک کنید"}
          </div>
        </div>
        {transcript && (
          <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-neutral-700">“{transcript}”</p>
        )}
      </div>

      {/* Form */}
      <div className="mt-5 space-y-4">
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500"
        >
          <option value="">انتخاب خدمت</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.price.toLocaleString("fa-IR")} تومان
            </option>
          ))}
        </select>

        <input
          placeholder="نام و نام خانوادگی"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500"
        />
        <input
          placeholder="شماره موبایل"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm outline-none focus:border-pink-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm outline-none focus:border-pink-500"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm outline-none focus:border-pink-500"
          />
        </div>

        <button
          onClick={submit}
          disabled={canning}
          className="w-full rounded-xl bg-neutral-900 py-3.5 font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {canning ? "در حال ثبت..." : "ثبت نوبت"}
        </button>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
