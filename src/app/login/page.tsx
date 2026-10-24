"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "email" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function requestOtp() {
    setLoading(true); setError(""); setMsg("");
    const res = await fetch("/api/auth/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "خطا در ارسال کد");
    setMsg("کد تأیید به شماره شما ارسال شد. (در حالت توسعه، کد در کنسول سرور نمایش داده می‌شود)");
    setStep("code");
  }

  async function requestEmailOtp() {
    setLoading(true); setError(""); setMsg("");
    const res = await fetch("/api/auth/email/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "خطا در ارسال کد");
    setMsg("کد تأیید به ایمیل شما ارسال شد.");
    setStep("code");
  }

  async function verifyCode() {
    setLoading(true); setError("");
    const isEmail = email.includes("@");
    const endpoint = isEmail ? "/api/auth/email/verify" : "/api/auth/otp/verify";
    const payload = isEmail ? { email, code } : { phone, code };
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "کد صحیح نیست");
    router.push("/dashboard");
    router.refresh();
  }

  const input = "w-full rounded-2xl border border-neutral-200 bg-neutral-50/60 px-4 py-3.5 text-center text-lg font-semibold outline-none transition focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-100";

  const stepLabel = step === "phone" ? "شماره موبایل" : step === "email" ? "ایمیل" : "کد تأیید";

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-6 py-12">
      {/* پس‌زمینه */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-pink-100 via-white to-purple-100" />
      <div className="absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 -z-10 h-80 w-80 rounded-full bg-purple-300/30 blur-3xl" />

      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/60 bg-white shadow-2xl shadow-pink-500/10 lg:grid-cols-2">
        {/* برند */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-bl from-pink-600 via-rose-600 to-purple-700 p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-hero-pattern" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur">🪞</span>
              <span className="text-xl font-black">نوبینو</span>
            </div>
            <h2 className="mt-8 text-3xl font-black leading-tight">زیبایی شما،<br />برنامه‌ریزی هوشمند</h2>
            <p className="mt-3 text-rose-100/90">نوبت‌دهی صوتی، یادآوری خودکار و مدیریت مالی در یک پلتفرم.</p>
          </div>
          <div className="relative space-y-3 text-sm text-rose-100/90">
            {["🎙️ رزرو با صدای فارسی", "📲 پیامک یادآوری", "📊 گزارش و تحلیل دقیق"].map((f) => (
              <div key={f} className="flex items-center gap-2">{f}</div>
            ))}
          </div>
        </div>

        {/* فرم */}
        <div className="p-8 sm:p-10">
          <h1 className="text-2xl font-black text-neutral-900">ورود به نوبینو</h1>
          <p className="mt-1 text-sm text-neutral-500">با {stepLabel} وارد شوید</p>

          <div className="mt-6 space-y-4">
            {step === "phone" && (
              <>
                <input type="tel" dir="ltr" placeholder="09120000000" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
                <button onClick={requestOtp} disabled={loading || phone.length < 11} className="w-full rounded-2xl bg-gradient-to-l from-pink-600 to-purple-600 py-3.5 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.02] disabled:opacity-50">
                  {loading ? "در حال ارسال..." : "دریافت کد"}
                </button>
                <button onClick={() => setStep("email")} className="w-full text-sm font-semibold text-pink-600 hover:underline">
                  ورود با ایمیل به‌جای شماره
                </button>
              </>
            )}

            {step === "email" && (
              <>
                <input type="email" dir="ltr" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                <button onClick={requestEmailOtp} disabled={loading || !email.includes("@")} className="w-full rounded-2xl bg-gradient-to-l from-pink-600 to-purple-600 py-3.5 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.02] disabled:opacity-50">
                  {loading ? "در حال ارسال..." : "دریافت کد"}
                </button>
                <button onClick={() => setStep("phone")} className="w-full text-sm font-semibold text-pink-600 hover:underline">
                  ورود با شماره موبایل
                </button>
              </>
            )}

            {step === "code" && (
              <>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="····"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/60 px-4 py-4 text-center text-3xl font-black tracking-[0.6em] outline-none transition focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-100"
                />
                <button onClick={verifyCode} disabled={loading || code.length < 4} className="w-full rounded-2xl bg-gradient-to-l from-pink-600 to-purple-600 py-3.5 font-black text-white shadow-lg shadow-pink-500/25 transition hover:scale-[1.02] disabled:opacity-50">
                  {loading ? "در حال بررسی..." : "تأیید و ورود"}
                </button>
                <button onClick={() => setStep(email.includes("@") ? "email" : "phone")} className="w-full text-sm font-semibold text-neutral-500 hover:text-neutral-700">
                  تغییر شماره/ایمیل
                </button>
              </>
            )}

            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            {msg && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</p>}
          </div>

          <p className="mt-6 text-center text-xs text-neutral-400">
            <Link href="/" className="text-pink-600 hover:underline">بازگشت به خانه</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
