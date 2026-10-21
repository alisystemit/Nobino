"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Pkg = { id: string; name: string; description?: string; price: number; durationDays: number; features: string[] };
type Gateway = { id: string; name: string; sandbox: boolean };

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gateway, setGateway] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pkgRes, gwRes] = await Promise.all([
          fetch("/api/packages"),
          fetch("/api/payments/gateways"),
        ]);
        const pkgData = await pkgRes.json();
        const gwData = await gwRes.json();
        setPackages(pkgData.packages ?? []);
        setGateways(gwData.gateways ?? []);
        setGateway(gwData.gateways?.[0]?.id ?? "");

      } catch {
        setError("خطا در بارگیری داده‌ها");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function buy(pkgId: string) {
    setBuying(pkgId);
    setError("");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkgId, gateway, discountCode: discountCode || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "خطا در ایجاد پرداخت");
        return;
      }
      // انتقال به درگاه یا صفحه تست
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        router.push(`/payment/result?status=success`);
      }
    } catch {
      setError("خطای شبکه");
    } finally {
      setBuying(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="text-center">
        <h1 className="text-3xl font-black text-neutral-900">پکیج‌های نوبینو</h1>
        <p className="mt-2 text-neutral-500">برای آرایشگاه خود، یکی از پکیج‌ها را انتخاب کنید.</p>
      </div>

      {loading ? (
        <p className="mt-16 text-center text-neutral-400">در حال بارگیری...</p>
      ) : (
        <>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {packages.map((p) => (
              <div key={p.id} className="flex flex-col rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
                <h3 className="text-xl font-extrabold text-neutral-900">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-pink-600">{p.price.toLocaleString("fa-IR")}</span>
                  <span className="text-sm text-neutral-500">تومان</span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">به مدت {p.durationDays.toLocaleString("fa-IR")} روز</p>
                <ul className="mt-6 flex-1 space-y-2">
                  {(p.features ?? []).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-neutral-600">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <label className="text-xs font-medium text-neutral-500">درگاه پرداخت</label>
                  <select
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-pink-500"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.sandbox ? " (تست)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => buy(p.id)}
                  disabled={buying === p.id || !gateway}
                  className="mt-4 w-full rounded-xl bg-neutral-900 py-3.5 font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {buying === p.id ? "در حال انتقال..." : "خرید پکیج"}
                </button>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-md">
            <label className="text-xs font-medium text-neutral-500">کد تخفیف (اختیاری)</label>
            <input
              dir="ltr"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="مثلاً NOBINO20"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm outline-none focus:border-pink-500"
            />
          </div>

          {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">{error}</p>}
        </>
      )}

      <p className="mt-12 text-center text-sm text-neutral-400">
        برای ورود به حساب خود <Link href="/login" className="font-semibold text-pink-600">اینجا</Link> کلیک کنید.
      </p>
    </main>
  );
}
