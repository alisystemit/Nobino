"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileAudio,
  FileUp,
  Keyboard,
  Loader2,
  Mic,
  PenLine,
  PhoneCall,
  Quote,
  Sparkles,
  X,
} from "lucide-react";
import { PanelCard } from "@/components/ui/Stats";
import { HTTPS_HINT, clipboardAvailable, micBlockReason } from "@/lib/browser/capabilities";
import { useMicCapability } from "@/lib/browser/use-mic-capability";

type Service = { id: string; name: string; durationMin: number; price: number };
type Staff = { id: string; name: string; title?: string | null };
type Branch = { id: string; name: string };
type Extracted = { name?: string; phone?: string; service?: string; date?: string; time?: string; note?: string };
type FieldKey = "name" | "phone" | "service" | "date" | "time";
/** منبع ورودی گفتار: ضبط زنده، فایل صوتی آماده، یا جملهٔ تایپ‌شده */
type SpeechSource = { audio?: Blob | File; text?: string };

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "نام مشتری",
  phone: "شماره موبایل",
  service: "نام خدمت",
  date: "تاریخ",
  time: "ساعت",
};

const SAMPLE_SCRIPT =
  "سلام، می‌خوام نوبت رزرو کنم. برای فردا ساعت ده صبح، خدمت کوتاهی مو، به نام سارا احمدی، شماره موبایل ۰۹۱۲۳۴۵۶۷۸";

const REQUIRED_FIELDS: FieldKey[] = ["name", "phone", "date", "time"];

/**
 * رزرو صوتی خالص (بدون فرم دستی).
 * ضبط/آپلود/تایپ گفتار → transcribe → استخراج JSON → پیش‌نمایش → ثبت نوبت (channel=VOICE).
 * رزرو دستی به صفحهٔ مستقل `/dashboard/new-appointment` رفته است.
 *
 * چرا سه منبع ورودی؟ مرورگر روی بستر ناامن (http با پورت) `navigator.mediaDevices` را
 * تعریف نمی‌کند؛ پیش‌از‌این کلیک روی دکمهٔ میکروفون یک TypeError بی‌روانش می‌داد و صفحه
 * «می‌مرد». حالا قابلیت میکروفون سنجیده می‌شود، دلیلش فارسی نمایش داده می‌شود و
 * آپلود فایل صوتی / تایپ جمله از همان `/api/voice/transcribe` عبور می‌کنند.
 */
export default function AdminVoiceBooking({ salonId }: { salonId: string; salonSlug?: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const cap = useMicCapability();

  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [transcript, setTranscript] = useState("");
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [recording, setRecording] = useState(false);
  const [recField, setRecField] = useState<FieldKey | "">("");
  const [fragments, setFragments] = useState<{ field: FieldKey; text: string }[]>([]);
  const [voiceCallId, setVoiceCallId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [textForField, setTextForField] = useState<FieldKey | "">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoSubmittedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const micReason = cap ? micBlockReason(cap) : null;
  const micReady = cap !== null && micReason === null;

  function startRecording(field: FieldKey | "") {
    setMsg(null);
    if (!micReady) {
      setShowText(true);
      setMsg({
        ok: false,
        text: `${micReason ?? "میکروفون در دسترس نیست."} از «آپلود فایل صوتی» یا «تایپ جمله» استفاده کنید.`,
      });
      return;
    }
    setRecField(field);
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          const audio = new Blob(chunksRef.current, { type: "audio/webm" });
          if (field) void transcribeField(field, { audio });
          else void transcribe({ audio });
        };
        mr.start();
        recRef.current = mr;
        setRecording(true);
      })
      .catch(() => {
        setRecField("");
        setShowText(true);
        setMsg({
          ok: false,
          text: "دسترسی به میکروفون ممکن نیست. یا اجازهٔ ضبط را نداده‌اید، یا این آدرس امن (https) نیست.",
        });
      });
  }

  function stopRecording() {
    recRef.current?.stop();
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  /** آپلود فایل صوتی آماده — جایگزین ضبط وقتی میکروفون قفل یا محدود است */
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    if (textForField) {
      const field = textForField;
      setTextForField("");
      void transcribeField(field, { audio: file });
    } else {
      void transcribe({ audio: file });
    }
  }

  async function copyScript() {
    if (!clipboardAvailable(navigator.clipboard)) {
      setMsg({ ok: false, text: "کپی خودکار روی آدرس ناامن (http) بسته است. متن نمونه را با ماوس انتخاب و کپی کنید." });
      return;
    }
    try {
      await navigator.clipboard.writeText(SAMPLE_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ ok: false, text: "مرورگر اجازهٔ کپی نداد؛ متن را دستی انتخاب کنید." });
    }
  }

  async function submitAppointment(payload: {
    name: string;
    phone: string;
    date: string;
    time: string;
    serviceId: string;
    auto: boolean;
  }): Promise<boolean> {
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonId,
          serviceId: payload.serviceId || undefined,
          employeeId: employeeId || undefined,
          branchId: branchId || undefined,
          customerName: payload.name,
          customerPhone: payload.phone,
          startAt: new Date(`${payload.date}T${payload.time}:00`).toISOString(),
          channel: "VOICE",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا در ثبت");
      setMsg({
        ok: true,
        text: payload.auto
          ? "✅ نوبت به‌صورت خودکار از روی گفتار ثبت شد و هم‌زمان برای شما نمایش داده شد."
          : "✅ نوبت ثبت شد.",
      });
      if (!payload.auto) {
        setName("");
        setPhone("");
        setTime("");
        setDate("");
        setServiceId("");
      }
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
      return false;
    }
  }

  /** اگر همه فیلدهای اصلی کامل باشند، نوبت مستقیم در دیتابیس ثبت می‌شود */
  async function maybeAutoSubmit(ex: Extracted, matchedServiceId: string) {
    if (autoSubmittedRef.current) return;
    const missing = REQUIRED_FIELDS.filter((f) => !ex[f]);
    if (missing.length > 0) return;
    autoSubmittedRef.current = true;
    await submitAppointment({
      name: ex.name!,
      phone: ex.phone!,
      date: ex.date!,
      time: ex.time!,
      serviceId: matchedServiceId,
      auto: true,
    });
  }

  function applyExtracted(ex: Extracted) {
    setExtracted(ex);
    if (ex.name) setName(ex.name);
    if (ex.phone) setPhone(ex.phone);
    if (ex.time) setTime(ex.time);
    if (ex.date) setDate(ex.date);
    let matchedId = serviceId;
    if (ex.service) {
      const m = services.find((x) => ex.service && x.name.includes(ex.service!));
      if (m) {
        setServiceId(m.id);
        matchedId = m.id;
      }
    }
    return matchedId;
  }

  /**
   * بدنهٔ مشترک هر سه منبع ورودی. `partial` باعث می‌شود برش‌های بعدی (پاسخ یک
   * فیلد یا جملهٔ تکمیلی) یافته‌های قبلی را پاک نکنند.
   */
  function buildBody(source: SpeechSource, field?: FieldKey) {
    const form = new FormData();
    if (source.audio) {
      if (source.audio instanceof File) form.append("audio", source.audio);
      else form.append("audio", source.audio, "rec.webm");
    }
    if (source.text) form.append("text", source.text);
    form.append("salonId", salonId);
    form.append("phone", phone);
    if (field) {
      form.append("field", field);
      form.append("partial", JSON.stringify(extracted ?? {}));
    } else if (extracted) {
      form.append("partial", JSON.stringify(extracted));
    }
    if (voiceCallId) form.append("voiceCallId", voiceCallId);
    return form;
  }

  async function transcribe(source: SpeechSource) {
    setProcessing(true);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: buildBody(source) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      setTranscript(data.transcript);
      if (data.voiceCallId) setVoiceCallId(data.voiceCallId);
      const ex: Extracted = data.extracted ?? {};
      const matchedId = applyExtracted(ex);
      const missing = REQUIRED_FIELDS.filter((f) => !ex[f]);
      if (missing.length > 0) {
        setMsg({
          ok: false,
          text: `متن استخراج شد؛ ${missing.map((f) => FIELD_LABELS[f]).join("، ")} پیدا نشد. فقط همان مورد را بگویید، فایل بفرستید یا در پیش‌نمایش بنویسید.`,
        });
      } else {
        setMsg({ ok: true, text: "همه اطلاعات استخراج شد؛ در حال ثبت نوبت..." });
        await maybeAutoSubmit(ex, matchedId);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setProcessing(false);
      setShowText(false);
      setTypedText("");
    }
  }

  /** پرسش مجدد یک فیلد: مشتری فقط همان فیلد را می‌گوید (یا فقط همان را می‌نویسد/فایلش را می‌فرستد) */
  async function transcribeField(field: FieldKey, source: SpeechSource) {
    setProcessing(true);
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: buildBody(source, field) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      setFragments((prev) => [...prev, { field, text: data.transcript }]);
      if (data.voiceCallId) setVoiceCallId(data.voiceCallId);
      const ex: Extracted = data.extracted ?? {};
      const matchedId = applyExtracted(ex);
      if (data.fieldValue) {
        setMsg({ ok: true, text: `✅ ${FIELD_LABELS[field]} دریافت شد: ${data.fieldValue}` });
      } else {
        setMsg({ ok: false, text: `متأسفانه ${FIELD_LABELS[field]} باز هم قابل تشخیص نبود. لطفاً آن را در پیش‌نمایش بنویسید.` });
      }
      await maybeAutoSubmit(ex, matchedId);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setRecField("");
      setTextForField("");
      setProcessing(false);
      setShowText(false);
      setTypedText("");
    }
  }

  function submitTypedSentence() {
    const text = typedText.trim();
    if (text.length < 3) {
      return setMsg({
        ok: false,
        text: "جمله را کامل‌تر بنویسید؛ مثلاً «فردا ساعت ۱۰ کوتاهی مو برای سارا، ۰۹۱۲۳۴۵۶۷۸».",
      });
    }
    if (textForField) void transcribeField(textForField, { text });
    else void transcribe({ text });
  }

  /** اصلاح یا تکمیل یک فیلد در پیش‌نمایش؛ extracted و فیلدهای ثبت همیشه هم‌خوان می‌مانند */
  function fillField(field: FieldKey, value: string) {
    const next = { ...(extracted ?? {}) } as Extracted;
    if (value) next[field] = value;
    else delete next[field];
    setExtracted(next);
    if (field === "name") setName(value);
    if (field === "phone") setPhone(value);
    if (field === "date") setDate(value);
    if (field === "time") setTime(value);
    if (field === "service") {
      const m = services.find((x) => x.name.includes(value));
      if (m) setServiceId(m.id);
    }
    // کاربر خودش کاملش کرد؛ دیگر لازم نیست ثبت خودکار تکراری انجام شود
    if (REQUIRED_FIELDS.every((f) => Boolean(next[f]))) autoSubmittedRef.current = true;
  }

  async function submit() {
    if (!name || !phone || !date || !time) return setMsg({ ok: false, text: "نام، شماره، تاریخ و ساعت الزامی است." });
    setProcessing(true);
    setMsg(null);
    await submitAppointment({ name, phone, date, time, serviceId, auto: false });
    setProcessing(false);
  }

  const input =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-sm outline-none focus:border-pink-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800";
  const missing = extracted ? REQUIRED_FIELDS.filter((f) => !extracted[f]) : [];
  const found = extracted ? REQUIRED_FIELDS.filter((f) => Boolean(extracted[f])) : [];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* ── ضبط صوتی و استخراج هوش مصنوعی ── */}
      <PanelCard
        title="رزرو صوتی هوشمند"
        subtitle="صدا → متن → استخراج JSON → ثبت در دیتابیس"
        icon={<Mic className="h-5 w-5" />}
      >
        {/* هشدار قفل بودن میکروفون + راه‌جایگزین‌ها */}
        {cap && micReason && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="text-[11px] leading-5 text-amber-800 dark:text-amber-200">
                <p className="text-xs font-black">میکروفون روی این آدرس قفل است</p>
                <p className="mt-1">{micReason}</p>
                <p className="mt-1 text-amber-700/90 dark:text-amber-300/80">{HTTPS_HINT}</p>
              </div>
            </div>
          </div>
        )}

        {/* راهنمای قدم‌به‌قدم */}
        <div className="grid gap-2 text-[11px] font-bold text-neutral-500 dark:text-neutral-400 sm:grid-cols-2">
          {[
            "۱. متن نمونه را با مشخصات واقعی بخوانید",
            "۲. ربات گفتار را به متن تبدیل می‌کند",
            "۳. اگر بخشی نفهمید فقط همان را می‌پرسد",
            "۴. نوبت خودکار در دیتابیس ثبت می‌شود",
          ].map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-pink-500" />
              {s}
            </div>
          ))}
        </div>

        {/* متن نمونه برای خواندن */}
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-sky-700 dark:text-sky-300">
              <Quote className="h-4 w-4" /> متن نمونه — از روی این بخوانید
            </div>
            <button
              onClick={copyScript}
              className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-sky-700 shadow-sm transition hover:bg-sky-100 dark:bg-neutral-800 dark:text-sky-300"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">«{SAMPLE_SCRIPT}»</p>
          <p className="mt-2 text-[11px] text-sky-600/80 dark:text-sky-400/70">
            نام، شماره، خدمت، تاریخ و ساعت را با مشخصات واقعی مشتری عوض کنید. اگر ربات بخشی را نفهمید، نگران نباشید — فقط همان بخش را دوباره می‌پرسد.
          </p>
        </div>

        {/* دکمه ضبط + دو منبع جایگزین */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={() => (recording ? stopRecording() : startRecording(""))}
            disabled={processing || Boolean(recField) || !micReady}
            title={micReason ?? "ضبط صدا"}
            className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition disabled:opacity-50 ${
              recording
                ? "bg-red-500 shadow-red-500/30"
                : "bg-gradient-to-br from-pink-600 to-purple-600 shadow-pink-500/30 hover:scale-105"
            }`}
          >
            {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/60" />}
            {recording ? (
              <span className="relative h-6 w-6 rounded-sm bg-white" />
            ) : (
              <Mic className="relative h-7 w-7" />
            )}
          </button>
          <div className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {recording ? (
              <span className="font-bold text-red-500">در حال ضبط... برای پایان دوباره کلیک کنید</span>
            ) : processing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> در حال پردازش هوش مصنوعی...
              </span>
            ) : micReady ? (
              "کلیک کنید و متن نمونه را بخوانید"
            ) : (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {cap === null ? "در حال بررسی امکان میکروفون..." : "ضبط صدا غیرفعال است — فایل صوتی بفرستید یا جمله را تایپ کنید"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTextForField("");
                fileRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-black text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <FileUp className="h-3.5 w-3.5" /> فایل صوتی
            </button>
            <button
              onClick={() => {
                setShowText((v) => !v);
                setTextForField("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-black text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <Keyboard className="h-3.5 w-3.5" /> تایپ جمله
            </button>
          </div>
          <input ref={fileRef} type="file" accept="audio/*,.ogg,.webm,.mp3,.wav,.m4a,.aac" className="hidden" onChange={onPickFile} />
        </div>

        {/* ورود متنی: جمله کامل یا فقط یک فیلد */}
        {showText && (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-950/20">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-black text-purple-700 dark:text-purple-300">
                <PenLine className="h-4 w-4" />
                {textForField ? `فقط ${FIELD_LABELS[textForField]} را بنویسید` : "جملهٔ کامل رزرو را بنویسید"}
              </p>
              <button onClick={() => setShowText(false)} aria-label="بستن" className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              className={`${input} mt-2 h-20 resize-y leading-6`}
              placeholder={
                textForField
                  ? `${FIELD_LABELS[textForField]} — مثلاً ${textForField === "time" ? "10:30" : textForField === "date" ? "فردا" : "…"}`
                  : "فردا ساعت ده صبح کوتاهی مو، سارا احمدی، ۰۹۱۲۳۴۵۶۷۸"
              }
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={submitTypedSentence}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 px-4 py-2 text-xs font-black text-white shadow transition hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> استخراج
              </button>
              {!micReady && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2 text-xs font-black text-purple-700 transition hover:bg-purple-50 dark:border-purple-800 dark:bg-neutral-800 dark:text-purple-300"
                >
                  <FileUp className="h-3.5 w-3.5" /> یا فایل صوتی بفرستید
                </button>
              )}
            </div>
          </div>
        )}

        {/* متن تبدیل‌شده */}
        {transcript && (
          <div className="mt-4 rounded-2xl bg-pink-50 p-4 dark:bg-pink-950/30">
            <div className="flex items-center gap-2 text-xs font-black text-pink-700 dark:text-pink-300">
              <FileAudio className="h-4 w-4" /> گفتار تبدیل‌شده به متن
            </div>
            <p className="mt-2 text-sm leading-relaxed text-pink-900 dark:text-pink-200">“{transcript}”</p>
          </div>
        )}

        {/* پاسخ‌های تکمیلی */}
        {fragments.map((fr, i) => (
          <div key={i} className="mt-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            <span className="font-black text-neutral-600 dark:text-neutral-300">{FIELD_LABELS[fr.field]}:</span> “{fr.text}”
          </div>
        ))}

        {/* نتیجه استخراج */}
        {extracted && (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-800 dark:bg-purple-950/20">
            <div className="flex items-center gap-2 text-xs font-black text-purple-700 dark:text-purple-300">
              <Sparkles className="h-4 w-4" /> خروجی هوش مصنوعی (JSON → دیتابیس)
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {[
                ["name", extracted.name],
                ["phone", extracted.phone],
                ["service", extracted.service],
                ["date", extracted.date],
                ["time", extracted.time],
              ]
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-bold text-purple-700 shadow-sm dark:bg-purple-900/40 dark:text-purple-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {FIELD_LABELS[k as FieldKey]}: {v}
                  </span>
                ))}
            </div>

            {/* پرسش مجدد فقط همان فیلدِ نامفهوم: صوت، فایل یا متن */}
            {missing.map((f) => (
              <div key={f} className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" />
                    ربات «{FIELD_LABELS[f]}» را متوجه نشد
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => (recField === f ? stopRecording() : startRecording(f))}
                      disabled={processing || (recField !== "" && recField !== f) || !micReady}
                      title={micReason ?? `فقط ${FIELD_LABELS[f]} را بگویید`}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition disabled:opacity-50 ${
                        recField === f
                          ? "bg-red-500 text-white"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {recField === f ? (
                        <>
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> در حال ضبط... پایان
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5" /> فقط {FIELD_LABELS[f]} را بگویید
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setTextForField(f);
                        setShowText(true);
                      }}
                      disabled={processing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-black text-amber-800 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-200"
                    >
                      <Keyboard className="h-3.5 w-3.5" /> نوشتن {FIELD_LABELS[f]}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {missing.length === 0 && (
              <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ همه اطلاعات کامل است</p>
            )}
          </div>
        )}
        {found.length === 0 && !extracted && !transcript && (
          <p className="mt-3 text-xs text-neutral-400">
            هنوز گفتاری پردازش نشده است. دکمه ضبط را بزنید و متن نمونه را بخوانید — یا فایل صوتی/متن را بفرستید.
          </p>
        )}
      </PanelCard>

      {/* ── پیش‌نمایش گفتار و تأیید ثبت ── */}
      <PanelCard
        title="پیش‌نمایش نوبت گفتاری"
        subtitle="فیلدهای شناسایی‌شده از صدا؛ فقط جای خالی را پر کنید"
        icon={<ClipboardList className="h-5 w-5" />}
        className="self-start"
      >
        <div className="space-y-3">
          <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">خدمت (از گفتار یا انتخاب)</option>
            {services.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          {staff.length > 0 && (
            <select className={input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">آرایشگر (اختیاری)</option>
              {staff.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
          {branches.length > 1 && (
            <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">شعبه</option>
              {branches.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input className={input} placeholder="نام مشتری" value={name} onChange={(e) => fillField("name", e.target.value)} />
            <input className={`${input} text-center`} dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸" value={phone} onChange={(e) => fillField("phone", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={input} value={date} onChange={(e) => fillField("date", e.target.value)} />
            <input type="time" className={input} value={time} onChange={(e) => fillField("time", e.target.value)} />
          </div>
          <button
            onClick={submit}
            disabled={processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 py-3 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.01] disabled:opacity-50"
          >
            <CalendarPlus className="h-4 w-4" />
            {processing ? "در حال ثبت..." : "تأیید و ثبت نوبت صوتی"}
          </button>
          {msg && (
            <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"}`}>
              {msg.text}
            </p>
          )}

          <div className="rounded-2xl border border-dashed border-neutral-200 p-4 dark:border-neutral-700">
            <p className="text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
              این کارت فقط پیش‌نمایشِ گفتهٔ مشتری است. برای وارد کردن کامل نوبت بدون صوت (مشتری تلفنی یا حضوری) از صفحهٔ مستقل رزرو دستی استفاده کنید.
            </p>
            <Link
              href="/dashboard/new-appointment"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c2434] py-2.5 text-xs font-black text-white transition hover:bg-[#2a3450]"
            >
              <PhoneCall className="h-4 w-4" /> رزرو دستی نوبت
            </Link>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
