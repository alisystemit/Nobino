import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toPersianDigits, formatToman } from "@/lib/utils";
import PayCard from "./PayCard";
import type { Metadata } from "next";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { payToken: token }, select: { salon: { select: { name: true } } } });
  if (!invoice) return { title: "فاکتور یافت نشد — نوبینو" };
  return { title: `پرداخت فاکتور ${invoice.salon.name} — نوبینو`, robots: { index: false, follow: false } };
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { payToken: token },
    select: {
      id: true,
      number: true,
      kind: true,
      amount: true,
      description: true,
      customerName: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      paidAt: true,
      salon: { select: { name: true, city: true, slug: true } },
    },
  });
  if (!invoice) notFound();

  const paid = invoice.status === "PAID";
  const expired = !paid && invoice.dueAt && new Date(invoice.dueAt) < new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-pink-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-2xl shadow-pink-500/5">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-3xl shadow-lg shadow-pink-500/30">
              🧾
            </div>
            <h1 className="mt-4 text-xl font-black text-neutral-900">
              {paid ? "فاکتور پرداخت‌شده" : "پرداخت آنلاین فاکتور"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{invoice.salon.name}{invoice.salon.city ? ` — ${invoice.salon.city}` : ""}</p>
          </div>

          <div className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">شماره فاکتور</span>
              <span className="font-bold text-neutral-800" dir="ltr">{toPersianDigits(invoice.number)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">تاریخ صدور</span>
              <span className="font-bold text-neutral-800">{new Date(invoice.issuedAt).toLocaleDateString("fa-IR")}</span>
            </div>
            {invoice.customerName && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">مشتری</span>
                <span className="font-bold text-neutral-800">{invoice.customerName}</span>
              </div>
            )}
            {invoice.description && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-neutral-500">شرح</span>
                <span className="text-left font-medium text-neutral-800">{invoice.description}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
              <span className="text-neutral-600">مبلغ قابل پرداخت</span>
              <span className="text-lg font-black text-pink-600">{formatToman(invoice.amount)}</span>
            </div>
          </div>

          {paid ? (
            <div className="mt-6 rounded-2xl bg-green-50 p-4 text-center">
              <p className="font-bold text-green-700">✅ این فاکتور پرداخت شده است</p>
              {invoice.paidAt && (
                <p className="mt-1 text-xs text-green-600">تاریخ پرداخت: {new Date(invoice.paidAt).toLocaleDateString("fa-IR")}</p>
              )}
            </div>
          ) : expired ? (
            <div className="mt-6 rounded-2xl bg-red-50 p-4 text-center">
              <p className="font-bold text-red-600">این فاکتور منقضی شده است</p>
              <p className="mt-1 text-xs text-red-500">لطفاً با سالن تماس بگیرید تا فاکتور جدیدی صادر شود.</p>
            </div>
          ) : (
            <>
              <PayCard token={token} />
              <p className="mt-4 text-center text-xs text-neutral-400">
                با پرداخت این فاکتور، پرداخت شما به‌صورت خودکار برای {invoice.salon.name} ثبت می‌شود.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          پرداخت امن با درگاه‌های معتبر بانکی ·{" "}
          <Link href={invoice.salon.slug ? `/s/${invoice.salon.slug}` : "/"} className="text-pink-500 hover:underline">
            مشاهده صفحه سالن
          </Link>
        </p>
      </div>
    </main>
  );
}
