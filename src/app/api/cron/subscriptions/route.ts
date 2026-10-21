import { prisma } from "@/lib/prisma";
import { renewSubscription } from "@/lib/subscriptions";
import { enqueueSms, processPendingNotifications } from "@/lib/notifications/queue";
import { json } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * Cron اشتراک (روزانه):
 * - تمدید خودکار اشتراک‌های در شرف پایان که autoRenew دارند.
 * - منقضی کردن اشتراک‌های تمام‌شده بدون تمدید و اطلاع‌رسانی.
 * - یادآوری پایان دوره پیش از انقضا.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const soon = new Date(Date.now() + 3 * 864e5); // ۳ روز بعد

  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", endsAt: { lte: soon } },
    include: { salon: true, package: true },
  });

  let renewed = 0;
  let expired = 0;
  let reminded = 0;

  for (const sub of due) {
    if (sub.endsAt <= now) {
      if (sub.autoRenew) {
        await renewSubscription(sub.id);
        renewed++;
      } else {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
        await prisma.salon.update({ where: { id: sub.salonId }, data: { plan: "FREE", subscriptionEndsAt: null } });
        await enqueueSms({
          type: "SUBSCRIPTION_EXPIRED",
          recipient: sub.salon.phone,
          message: `اشتراک «${sub.package.name}» برای «${sub.salon.name}» منقضی شد. برای ادامه، تمدید کنید.`,
          uniqueKey: `subexpired:${sub.id}`,
        });
        expired++;
      }
    } else {
      await enqueueSms({
        type: "SUBSCRIPTION_RENEWAL_REMINDER",
        recipient: sub.salon.phone,
        message: `اشتراک «${sub.package.name}» برای «${sub.salon.name}» تا ${sub.endsAt.toLocaleDateString("fa-IR")} اعتبار دارد.`,
        uniqueKey: `subremind:${sub.id}`,
      });
      reminded++;
    }
  }

  const result = await processPendingNotifications(30);

  return json({ success: true, scanned: due.length, renewed, expired, reminded, ...result });
}
