import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/payments/registry";
import type { PaymentOrder } from "@/lib/payments/types";
import { env } from "@/lib/env";

/**
 * موتور پرداخت - هماهنگ‌کننده همه درگاه‌ها.
 * مراحل: ساخت Order و Payment → دریافت لینک درگاه → بازگشت → Verify → به‌روزرسانی.
 */

export async function createPaymentForOrder(params: {
  orderId: string;
  gateway?: string;
}): Promise<{ payment: { id: string; gateway: string; authority?: string | null; redirectUrl?: string }; gateway: string }> {
  const gwId = params.gateway ?? env.PAYMENT_DEFAULT_GATEWAY;
  const gateway = getGateway(gwId);

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { package: true, user: true },
  });
  if (!order) throw new Error("سفارش یافت نشد");
  if (order.status === "PAID") throw new Error("سفارش قبلاً پرداخت شده است");

  const callbackUrl = `${env.PAYMENT_CALLBACK_BASE}/${gwId}?order=${order.id}`;

  // لغو پرداخت‌های قبلی pending برای این سفارش
  await prisma.payment.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      gateway: gwId,
      amount: order.amount,
      status: "PENDING",
      callbackUrl,
    },
  });

  const paymentOrder: PaymentOrder = {
    id: order.id,
    amount: order.amount,
    description: `خرید پکیج ${order.package?.name ?? ""} - سفارش ${order.id}`,
    callbackUrl,
    customer: { phone: order.user?.phone, name: order.user?.name ?? undefined },
  };

  const result = await gateway.requestPayment(paymentOrder);

  await prisma.payment.update({
    where: { id: payment.id },
    data: { authority: result.authority ?? null, payload: { request: result.raw } as never },
  });

  if (!result.success) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new Error(result.message ?? "خطا در ایجاد درخواست پرداخت");
  }

  return {
    payment: { id: payment.id, gateway: gwId, authority: result.authority, redirectUrl: result.redirectUrl },
    gateway: gwId,
  };
}

/**
 * پردازش بازگشت (Callback) از درگاه.
 * پس از Verify موفق، وضعیت Order و Payment به PAID تغییر می‌کند.
 */
export async function handlePaymentCallback(params: {
  gatewayId: string;
  orderId: string;
  authority?: string;
  searchParams: Record<string, string>;
}): Promise<{ success: boolean; companyId?: string; message?: string }> {
  const gateway = getGateway(params.gatewayId);
  const order = await prisma.order.findUnique({ where: { id: params.orderId }, include: { package: true, user: true } });
  if (!order) return { success: false, message: "سفارش یافت نشد" };

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, gateway: params.gatewayId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const paymentOrder: PaymentOrder = {
    id: order.id,
    amount: order.amount,
    description: "پرداخت",
    callbackUrl: payment?.callbackUrl ?? "",
  };

  const result = await gateway.verifyPayment({
    order: paymentOrder,
    authority: params.authority ?? payment?.authority ?? undefined,
    params: params.searchParams,
  });

  if (result.success) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
      prisma.payment.update({
        where: { id: payment?.id ?? "" },
        data: { status: "PAID", refId: result.refId, cardPan: result.cardPan, payload: { verified: result.raw } as never },
      }),
    ]);

    // فعال‌سازی اشتراک پکیج برای سالن
    if (order.salonId && order.packageId) {
      await prisma.subscription.create({
        data: {
          salonId: order.salonId,
          packageId: order.packageId,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + order.package.durationDays * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
      await prisma.salon.update({
        where: { id: order.salonId },
        data: { subscriptionEndsAt: new Date(Date.now() + order.package.durationDays * 24 * 60 * 60 * 1000) },
      });
    }

    return { success: true, companyId: result.refId };
  }

  await prisma.payment.update({
    where: { id: payment?.id ?? "" },
    data: { status: "FAILED", payload: { verifyFailed: result.raw } as never },
  });

  return { success: false, message: result.message ?? "پرداخت ناموفق" };
}

/** برای درگاه‌های sandbox، این مسیر پرداخت تست را شبیه‌سازی می‌کند */
export async function simulateSandboxPay(params: { orderId: string; authority?: string }) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { success: false, message: "سفارش یافت نشد" };
  return { success: true, note: "پرداخت تست شبیه‌سازی‌شده", orderId: params.orderId };
}
