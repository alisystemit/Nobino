import { prisma } from "@/lib/prisma";
import type { Setting } from "@prisma/client";

/**
 * سیستم تنظیمات پویا (قابل ویرایش از پنل سوپرادمین).
 * - مقادیر در جدول `Setting` ذخیره می‌شوند.
 * - اگر کلیدی موجود نباشد، می‌توان مقدار پیش‌فرض از env ارائه داد.
 */

type Cached = { t: number; row: Setting | null };
const cache = new Map<string, Cached>();
const TTL = 8000; // ۸ ثانیه

export async function getSetting(key: string): Promise<string | undefined> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.row?.value ?? undefined;
  const row = await prisma.setting.findUnique({ where: { key } });
  cache.set(key, { t: Date.now(), row });
  return row?.value ?? undefined;
}

export async function getSettingGroup(prefix: string): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: prefix } } });
  const out: Record<string, string> = {};
  for (const r of rows) {
    const suffix = r.key.slice(prefix.length);
    out[suffix] = r.value ?? "";
  }
  return out;
}

export async function getAllSettings(): Promise<Setting[]> {
  return prisma.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
}

export async function updateSetting(key: string, value: string, extra?: Partial<Setting>) {
  cache.delete(key);
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value, ...extra },
    create: { key, value, group: extra?.group ?? "general", type: extra?.type ?? "string", isSecret: extra?.isSecret ?? false, ...extra },
  });
  return row;
}

export function invalidateSettings() {
  cache.clear();
}

/** مقدار env یا تنظیم پویا (اولویت با تنظیم پویا) */
export async function settingOrEnv(key: string, envValue?: string): Promise<string | undefined> {
  const s = await getSetting(key);
  if (s != null) return s;
  return envValue;
}
