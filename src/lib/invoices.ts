import { prisma } from "@/lib/prisma";
import type { PaymentStatus } from "@prisma/client";

function invoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `INV-${y}${m}${d}-${rand}`;
}

/** ساخت فاکتور برای یک سفارش پرداخت‌شده یا در انتظار پرداخت */
export async function generateInvoiceForOrder(orderId: string, subscriptionId?: string | null) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { package: true } });
  if (!order) return null;

  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const isPaid = order.status === "PAID";
  return prisma.invoice.create({
    data: {
      number: invoiceNumber(),
      salonId: order.salonId ?? "",
      subscriptionId: subscriptionId ?? null,
      orderId: order.id,
      amount: order.amount,
      originalAmount: order.originalAmount,
      period: order.period,
      status: isPaid ? "PAID" : "PENDING",
      issuedAt: new Date(),
      dueAt: isPaid ? null : new Date(Date.now() + 7 * 864e5),
      paidAt: isPaid ? new Date() : null,
    },
  });
}

export async function updateInvoiceStatus(orderId: string, status: PaymentStatus) {
  const invoice = await prisma.invoice.findUnique({ where: { orderId } });
  if (!invoice) return null;
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { status, paidAt: status === "PAID" ? new Date() : null },
  });
}
