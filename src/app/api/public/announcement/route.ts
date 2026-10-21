import { getSetting } from "@/lib/settings";
import { json } from "@/lib/utils";

/** اعلان سراسری (قابل تنظیم توسط ادمین) — عمومی */
export async function GET() {
  const text = await getSetting("general.announcement");
  return json({ success: true, announcement: text?.trim() || null });
}
