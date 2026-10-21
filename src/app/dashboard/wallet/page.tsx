"use client";

import { useEffect, useState } from "react";
import { formatToman } from "@/lib/utils";

type Tx = { id: string; kind: string; reason: string; amount: number; balanceAfter: number; description?: string; createdAt: string };

const kindLabels: Record<string, string> = { CREDIT: "واریز", DEBIT: "برداشت" };
const reasonLabels: Record<string, string> = {
  PACKAGE_PURCHASE: "خرید پکیج",
  COMMISSION_EARNING: "کمیسیون",
  COMMISSION_PAYOUT: "تسویه کمیسیون",
  PAYOUT: "تسویه",
  REFUND: "بازگشت وجه",
  ADMIN_ADJUSTMENT: "اصلاح توسط ادمین",
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/wallet");
    const data = await res.json();
    if (data.success) {
      setBalance(data.wallet.balance);
      setTransactions(data.wallet.transactions);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function requestPayout() {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), method: "BANK", bankInfo }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "خطا");
      setMsg({ ok: true, text: "درخواست تسویه ثبت شد." });
      setAmount("");
      setBankInfo("");
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "خطا" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-6 py-12 text-center text-neutral-400">در حال بارگیری...</main>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-black text-neutral-900">کیف پول</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-3xl bg-gradient-to-bl from-pink-500 to-purple-600 p-6 text-white shadow-lg">
          <p className="text-sm text-white/80">موجودی قابل تسویه</p>
          <p className="mt-2 text-3xl font-black">{formatToman(balance)}</p>
          <div className="mt-6 space-y-3">
            <input
              type="number"
              placeholder="مبلغ (تومان)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 outline-none"
            />
            <input
              placeholder="شماره شبا یا کارت"
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
              className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 outline-none"
            />
            <button
              onClick={requestPayout}
              disabled={submitting || !amount || Number(amount) <= 0 || Number(amount) > balance}
              className="w-full rounded-xl bg-white py-3 font-bold text-pink-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {submitting ? "در حال ثبت..." : "درخواست تسویه"}
            </button>
            {msg && (
              <p className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? "bg-white/15 text-white" : "bg-red-900/40 text-red-100"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-neutral-900">تراکنش‌ها</h2>
          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto">
            {transactions.length === 0 && (
              <p className="py-10 text-center text-neutral-400">تراکنشی ثبت نشده است.</p>
            )}
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-neutral-800">{reasonLabels[t.reason] ?? t.reason}</div>
                  <div className="text-xs text-neutral-400">
                    {t.createdAt} — {t.description}
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-sm font-black ${t.kind === "CREDIT" ? "text-emerald-600" : "text-red-500"}`}>
                    {t.kind === "CREDIT" ? "+" : "−"} {formatToman(t.amount)}
                  </div>
                  <div className="text-xs text-neutral-400">{kindLabels[t.kind]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
