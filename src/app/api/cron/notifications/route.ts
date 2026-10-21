import { processPendingNotifications } from "@/lib/notifications/queue";
import { json } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** پردازش صف پیامک (با تلاش مجدد) — قابل صدا زدن از Cron یا دستی */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPendingNotifications(50);
  return json({ success: true, ...result });
}
