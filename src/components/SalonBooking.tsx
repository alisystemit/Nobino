"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  description?: string | null;
  category?: string | null;
  bufferMin?: number;
};
type Staff = { id: string; name: string; title?: string | null; services?: { id: string }[] };
type Extracted = { name?: string; phone?: string; service?: string; time?: string; note?: string };
type Slot = { startAt: string; endAt: string };
type Branch = { id: string; name: string; city?: string | null; address?: string | null };

/** تاریخ امروز در منطقه‌زمان سالن (نه منطقه‌زمان مرورگر) */
function todayISO(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

export default function SalonBooking({
  salonId,
  slug,
  timezone = "Asia/Tehran",
  maxAdvanceDays = 60,
  services,
  staff,
  branches = [],
}: {
  salonId: string;
  slug: string;
  timezone?: string;
  maxAdvanceDays?: number;
  services: Service[];
  staff: Staff[];
  branches?: Branch[];
}) {
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [slotISO, setSlotISO] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const today = todayISO(timezone);
  const maxDate = addDaysISO(today, Math.max(1, maxAdvanceDays));
  const serviceIdsKey = serviceIds.join(",");

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds]
  );
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  // فقط آرایشگرانی که همه خدمات انتخاب‌شده را ارائه می‌دهند
  const compatibleStaff = useMemo(
    () =>
      staff.filter((st) => {
        const offered = st.services?.map((s) => s.id) ?? [];
        if (offered.length === 0) return true;
        return serviceIds.every((id) => offered.includes(id));
      }),
    [staff, serviceIds]
  );
  const compatibleIdsKey = compatibleStaff.map((s) => s.id).join(",");

  useEffect(() => {
    if (employeeId && !compatibleIdsKey.split(",").includes(employeeId)) setEmployeeId("");
  }, [employeeId, compatibleIdsKey]);

  // بارگیری اسلات‌های آزاد وقتی خدمات + تاریخ انتخاب شد
  useEffect(() => {
    setSlotISO("");
    if (!serviceIdsKey || !date) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      try {
        const q = new URLSearchParams({ serviceIds: serviceIdsKey, date });
        if (employeeId) q.set("employeeId", employeeId);
        if (branchId) q.set("branchId", branchId);
        const res = await fetch(`/api/salons/${slug}/availability?${q}`);
        const data = await res.json();
        if (!cancelled) {
          setSlots(data.success ? data.slots : []);
          if (!data.success && data.error) setMsg({ ok: false, text: data.error });
        }
      } catch {
        if (!cancelled) {
          setSlots([]);
          setMsg({ ok: false, text: "خطا در دریافت زمان‌های آزاد. اتصال را بررسی کنید." });
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceIdsKey, date, employeeId, branchId, slug]);

  function toggleService(id: string) {
    setMsg(null);
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

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
        const matched = services.find((s) => ex.service && (s.name.includes(ex.service) || ex.service.includes(s.name)));
        if (matched) setServiceIds([matched.id]);
      }
      setMsg({ ok: true, text: "متن شما استخراج شد. خدمت، تاریخ و ساعت را بررسی و تأیید کنید." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }

  const submit = useCallback(async () => {
    if (serviceIds.length === 0) return setMsg({ ok: false, text: "حداقل یک خدمت انتخاب کنید." });
    if (!name.trim() || !phone.trim() || !date || !slotISO) {
      return setMsg({ ok: false, text: "نام، شماره موبایل، تاریخ و ساعت را کامل کنید." });
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonId,
          serviceIds,
          employeeId: employeeId || undefined,
          branchId: branchId || undefined,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          startAt: slotISO,
          channel: "WEBAPP",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "ثبت نوبت ناموفق بود");
      setMsg({ ok: true, text: "نوبت شما ثبت شد. پیامک تأیید و یادآوری برای شما ارسال می‌شود." });
      setName("");
      setPhone("");
      setDate("");
      setSlotISO("");
      setServiceIds([]);
      setEmployeeId("");
      setSlots([]);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSending(false);
    }
  }, [serviceIds, name, phone, date, slotISO, salonId, employeeId, branchId]);

  const input = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-pink-500";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-pink-500/5">
      <div className="bg-gradient-to-l from-pink-600 to-purple-600 px-6 py-4 text-white">
        <h3 className="text-lg font-black">رزرو نوبت</h3>
        <p className="text-xs text-white/80">خدمت (چند مورد هم ممکن است)، تاریخ و ساعت واقعاً آزاد را انتخاب کنید</p>
      </div>

      <div className="p-6">
        {/* Voice AI */}
        <div className="rounded-2xl bg-gradient-to-bl from-pink-50 to-purple-50 p-4">
          <p className="text-sm font-bold text-neutral-700">🎙️ نوبت‌دهی با صدا</p>
          <p className="mt-1 text-xs text-neutral-500">
            میکروفون را بزنید و با صدای فارسی بگویید چه زمانی برای چه خدمتی نوبت می‌خواهید.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={sending}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-pink-600 text-white transition hover:bg-pink-700 disabled:opacity-50"
              aria-label={recording ? "پایان ضبط" : "شروع ضبط صدا"}
            >
              {recording && <span className="absolute inset-0 rounded-full bg-pink-500 animate-ping-slow" />}
              <span className="relative text-xl">{recording ? "⏹️" : "🎤"}</span>
            </button>
            <div className="text-xs text-neutral-500">
              {recording ? "در حال ضبط... برای پایان کلیک کنید" : sending ? "در حال پردازش..." : "برای شروع کلیک کنید"}
            </div>
          </div>
          {transcript && (
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm leading-relaxed text-neutral-700">“{transcript}”</p>
          )}
        </div>

        {/* Form */}
        <div className="mt-5 space-y-4">
          {branches.length > 1 && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={input} aria-label="انتخاب شعبه">
              <option value="">انتخاب شعبه</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.city ? `— ${b.city}` : ""}
                </option>
              ))}
            </select>
          )}

          {/* انتخاب چند خدمت */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-600">۱. خدمات</span>
              {selectedServices.length > 0 && (
                <span className="text-[11px] text-neutral-500">
                  {selectedServices.length} خدمت — {totalDuration.toLocaleString("fa-IR")} دقیقه
                </span>
              )}
            </div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-neutral-200 p-2">
              {services.length === 0 && <p className="p-2 text-xs text-neutral-400">خدمتی ثبت نشده است.</p>}
              {services.map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      checked ? "bg-pink-50 text-pink-900 ring-1 ring-pink-200" : "hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(s.id)}
                      className="h-4 w-4 accent-pink-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {s.durationMin.toLocaleString("fa-IR")} دقیقه
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-xs font-bold text-pink-600">
                      {s.price.toLocaleString("fa-IR")} تومان
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedServices.length > 1 && (
              <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                مجموع: <b>{totalPrice.toLocaleString("fa-IR")} تومان</b> — زمان تقریبی{" "}
                <b>{totalDuration.toLocaleString("fa-IR")} دقیقه</b>
              </p>
            )}
          </div>

          {/* آرایشگر */}
          {compatibleStaff.length > 0 && (
            <div>
              <span className="mb-2 block text-xs font-bold text-neutral-600">۲. آرایشگر (اختیاری)</span>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={input} aria-label="انتخاب آرایشگر">
                <option value="">بدون ترجیح آرایشگر</option>
                {compatibleStaff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.title ? `(${st.title})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="mb-2 block text-xs font-bold text-neutral-600">۳. مشخصات شما</span>
            <div className="space-y-2">
              <input
                placeholder="نام و نام خانوادگی"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
                autoComplete="name"
              />
              <input
                placeholder="شماره موبایل — ۰۹۱۲۳۴۵۶۷۸۹"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${input} text-center`}
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-bold text-neutral-600">۴. تاریخ و ساعت آزاد</span>
            <input
              type="date"
              min={today}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={input}
              aria-label="تاریخ نوبت"
            />

            {loadingSlots && (
              <div className="mt-2 rounded-xl bg-neutral-50 py-4 text-center text-xs text-neutral-400">
                در حال بررسی زمان‌های واقعاً آزاد...
              </div>
            )}

            {!loadingSlots && date && serviceIds.length > 0 && slots.length > 0 && (
              <>
                <div className="mt-2 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                  {slots.map((s) => {
                    const active = slotISO === s.startAt;
                    return (
                      <button
                        key={s.startAt}
                        type="button"
                        onClick={() => setSlotISO(s.startAt)}
                        className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                          active
                            ? "border-pink-600 bg-pink-600 text-white"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-pink-300 hover:bg-pink-50"
                        }`}
                      >
                        {formatTime(s.startAt, timezone)}
                      </button>
                    );
                  })}
                </div>
                {slotISO && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    زمان انتخابی: {formatTime(slotISO, timezone)} — پایان تقریبی{" "}
                    {formatTime(
                      new Date(new Date(slotISO).getTime() + totalDuration * 60000).toISOString(),
                      timezone
                    )}
                  </p>
                )}
              </>
            )}

            {!loadingSlots && date && serviceIds.length > 0 && slots.length === 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 p-3">
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
                        body: JSON.stringify({
                          customerName: name,
                          customerPhone: phone,
                          serviceId: serviceIds[0],
                          employeeId: employeeId || undefined,
                        }),
                      });
                      const data = await res.json();
                      setMsg({
                        ok: data.success,
                        text: data.success
                          ? "در لیست انتظار ثبت شدید؛ در صورت آزادشدن زمان پیامک می‌گیرید ✅"
                          : data.error || "خطا",
                      });
                    }}
                    className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    ثبت در لیست انتظار
                  </button>
                )}
              </div>
            )}

            {!date && <p className="mt-2 text-[11px] text-neutral-400">برای دیدن زمان‌های آزاد، تاریخ را انتخاب کنید.</p>}
          </div>

          <button
            onClick={submit}
            disabled={sending || serviceIds.length === 0 || !slotISO}
            className="w-full rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 py-3.5 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.02] hover:shadow-pink-500/40 disabled:opacity-50"
          >
            {sending ? "در حال ثبت..." : "ثبت نوبت ✨"}
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
