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
    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "خطا در ارسال کد");
    setMsg("کد تأیید به شماره شما پیامک شد. (در حالت توسعه: پیامک در کنسول سرور لاگ می‌شود)");
    setStep("code");
  }

  async function requestEmailOtp() {
    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/auth/email/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "خطا در ارسال کد");
    setMsg("کد تأیید به ایمیل شما ارسال شد.");
    setStep("code");
  }

  async function verifyCode() {
    setLoading(true);
    setError("");
    const isEmail = email.includes("@");
    const endpoint = isEmail ? "/api/auth/email/verify" : "/api/auth/otp/verify";
    const payload = isEmail ? { email, code } : { phone, code };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return setError(data.error || "کد صحیح نیست");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-pink-50 via-white to-purple-50 px-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
          <div className="text-center">
            <Link href="/" className="text-3xl font-black text-pink-600">
              نوبینو
            </Link>
            <h1 className="mt-4 text-xl font-extrabold text-neutral-900">
              {step === "phone" ? "ورود با شماره موبایل" : step === "email" ? "ورود با ایمیل" : "ورود کد تأیید"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {step === "phone" ? "کد تأیید برای شما پیامک می‌شود." : step === "email" ? "کد تأیید به ایمیل شما ارسال می‌شود." : "کد ۴ رقمی را وارد کنید."}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {step === "phone" && (
              <>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="09120000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-lg font-semibold tracking-widest outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                />
                <button
                  onClick={requestOtp}
                  disabled={loading || phone.length < 11}
                  className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
                >
                  {loading ? "در حال ارسال..." : "دریافت کد"}
                </button>
                <button onClick={() => setStep("email")} className="w-full text-sm font-medium text-neutral-500 hover:text-neutral-700">
                  ورود با ایمیل به‌جای شماره
                </button>
              </>
            )}

            {step === "email" && (
              <>
                <input
                  type="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-lg font-semibold outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                />
                <button
                  onClick={requestEmailOtp}
                  disabled={loading || !email.includes("@")}
                  className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
                >
                  {loading ? "در حال ارسال..." : "دریافت کد"}
                </button>
                <button onClick={() => setStep("phone")} className="w-full text-sm font-medium text-neutral-500 hover:text-neutral-700">
                  ورود با شماره موبایل
                </button>
              </>
            )}

            {step === "code" && (
              <>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="1402"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                />
                <button
                  onClick={verifyCode}
                  disabled={loading || code.length < 4}
                  className="w-full rounded-xl bg-pink-600 py-3.5 font-bold text-white transition hover:bg-pink-700 disabled:opacity-50"
                >
                  {loading ? "در حال بررسی..." : "تأیید و ورود"}
                </button>
                <button
                  onClick={() => setStep(email.includes("@") ? "email" : "phone")}
                  className="w-full text-sm font-medium text-neutral-500 hover:text-neutral-700"
                >
                  تغییر شماره/ایمیل
                </button>
              </>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
