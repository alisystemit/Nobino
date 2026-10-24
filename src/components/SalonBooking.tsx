"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Service = { id: string; name: string; durationMin: number; price: number };
type Staff = { id: string; name: string; title?: string | null };
type Extracted = { name?: string; phone?: string; service?: string; time?: string; note?: string };
type Slot = { startAt: string; endAt: string };
type Branch = { id: string; name: string; city?: string | null; address?: string | null };

export default function SalonBooking({
  salonId,
  slug,
  services,
  staff,
  branches = [],
}: {
  salonId: string;
  slug: string;
  services: Service[];
  staff: Staff[];
  branches?: Branch[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [canning, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

  // بارگیری اسلات‌های آزاد وقتی خدمت + تاریخ انتخاب شد
  useEffect(() => {
    if (!serviceId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      try {
        const q = new URLSearchParams({ serviceId, date });
        if (employeeId) q.set("employeeId", employeeId);
        if (branchId) q.set("branchId", branchId);
        const res = await fetch(`/api/salons/${slug}/availability?${q}`);
        const data = await res.json();
        if (!cancelled) setSlots(data.success ? data.slots : []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, date, employeeId, branchId, slug]);

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
      setMsg({ ok: true, text: "متن شما استخراج شد. اطلاعات را بررسی کنید." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!name || !phone || !date || !time) {
      return setMsg({ ok: false, text: "همه فیلدها را پر کنید." });
    }
    setSending(true);
    setMsg(null);
    const startAt = new Date(`${date}T${time}:00`).toISOString();
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
          startAt,
          channel: "MANUAL",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "ثبت نوبت ناموفق بود");
      setMsg({ ok: true, text: "نوبت شما ثبت شد. پیامک تأیید ارسال خواهد شد." });
      setName(""); setPhone(""); setDate(""); setTime(""); setServiceId(""); setEmployeeId("");
      setSlots([]);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }

  const input = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-pink-500/5">
      <div className="bg-gradient-to-l from-pink-600 to-purple-600 px-6 py-4 text-white">
        <h3 className="text-lg font-black">رزرو نوبت</h3>
        <p className="text-xs text-white/80">در چند ثانیه نوبت خود را قطعی کنید</p>
      </div>

      <div className="p-6">
      {/* Voice AI */}
      <div className="rounded-2xl bg-gradient-to-bl from-pink-50 to-purple-50 p-4">
        <p className="text-sm font-bold text-neutral-700">🎙️ نوبت‌دهی با صدا</p>
        <p className="mt-1 text-xs text-neutral-500">میکروفون را بزنید و با صدای فارسی بگویید چه زمانی برای چه خدمتی نوبت می‌خواهید.</p>
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
        {branches.length > 1 && (
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={input}>
            <option value="">انتخاب شعبه</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.city ? `— ${b.city}` : ""}
              </option>
            ))}
          </select>
        )}

        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={input}>
          <option value="">انتخاب خدمت</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.price.toLocaleString("fa-IR")} تومان
            </option>
          ))}
        </select>

        {staff.length > 0 && (
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={input}>
            <option value="">بدون ترجیح آرایشگر</option>
            {staff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} {st.title ? `(${st.title})` : ""}
              </option>
            ))}
          </select>
        )}

        <input placeholder="نام و نام خانوادگی" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <input placeholder="شماره موبایل" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${input} text-center`} />

        <div className="grid grid-cols-2 gap-3">
          <input type="date" min={today} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          {loadingSlots ? (
            <div className="flex items-center justify-center rounded-xl bg-neutral-50 text-xs text-neutral-400">در حال بررسی زمان‌ها...</div>
          ) : date && slots.length > 0 ? (
            <select value={time} onChange={(e) => setTime(e.target.value)} className={input}>
              <option value="">انتخاب ساعت</option>
              {slots.map((s) => (
                <option key={s.startAt} value={new Date(s.startAt).toTimeString().slice(0, 5)}>
                  {new Date(s.startAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center justify-center rounded-xl bg-neutral-50 text-xs text-neutral-400">
              {date ? "زمان آزادی نیست" : "تاریخ را انتخاب کنید"}
            </div>
          )}
        </div>

        {date && serviceId && slots.length === 0 && !loadingSlots && (
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-700">
              برای این خدمت در این روز زمانی آزاد نیست؛ تاریخ دیگری را امتحان کنید
              {name && phone && " یا در لیست انتظار قرار بگیرید."}
            </p>
            {name && phone && (
              <button
                onClick={async () => {
                  const res = await fetch(`/api/salons/${slug}/waitlist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerName: name, customerPhone: phone, serviceId, employeeId: employeeId || undefined }),
                  });
                  const data = await res.json();
                  setMsg({ ok: data.success, text: data.success ? "در لیست انتظار ثبت شدید؛ در صورت آزادشدن زمان پیامک می‌گیرید ✅" : data.error || "خطا" });
                }}
                className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                ثبت در لیست انتظار
              </button>
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={canning || (Boolean(date) && !time)}
          className="w-full rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 py-3.5 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.02] hover:shadow-pink-500/40 disabled:opacity-50"
        >
          {canning ? "در حال ثبت..." : "ثبت نوبت ✨"}
        </button>

        {msg && (
          <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
