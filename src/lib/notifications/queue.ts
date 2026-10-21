import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";

const MAX_ATTEMPTS = 5;

/** قرار دادن پیامک در صف (با حذف تکراری از طریق uniqueKey) */
export async function enqueueSms(params: {
  type: string;
  recipient: string;
  message: string;
  uniqueKey?: string;
  delayMs?: number;
}) {
  if (params.uniqueKey) {
    const existing = await prisma.notification.findUnique({
      where: { uniqueKey: params.uniqueKey },
      select: { status: true },
    });
    // اگر قبلاً ارسال شده یا در صف است، دوباره اضافه نمی‌کنیم
    if (existing && existing.status !== "FAILED") return;
  }

  await prisma.notification.create({
    data: {
      type: params.type,
      channel: "SMS",
      recipient: params.recipient,
      payload: { message: params.message },
      uniqueKey: params.uniqueKey,
      status: "PENDING",
      nextAttemptAt: new Date(Date.now() + (params.delayMs ?? 0)),
    },
  });
}

/** پردازش پیامک‌های در انتظار با تلاش مجدد و پشتیبان‌گیری */
export async function processPendingNotifications(limit = 50) {
  const pending = await prisma.notification.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  const provider = await getSmsProvider();
  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    if (n.attempts >= MAX_ATTEMPTS) {
      await prisma.notification.update({ where: { id: n.id }, data: { status: "DROPPED" } });
      continue;
    }
    try {
      const message = (n.payload as { message?: string } | null)?.message ?? "";
      await provider.sendText(n.recipient, message);
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } catch (e) {
      failed++;
      const attempts = n.attempts + 1;
      const backoffMs = 60_000 * Math.pow(2, attempts - 1); // ۱د، ۲د، ۴د...
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          attempts,
          lastError: e instanceof Error ? e.message.slice(0, 300) : String(e),
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
    }
  }

  return { processed: pending.length, sent, failed };
}
