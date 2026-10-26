import { prisma } from "@/lib/prisma";
import type { Setting } from "@prisma/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

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
  if (!row) return undefined;
  // رمزگشایی مقادیر محرمانه
  if (row.isSecret && row.value) {
    try {
      return decryptSecret(row.value);
    } catch {
      return row.value;
    }
  }
  return row.value ?? undefined;
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
  const isSecret = extra?.isSecret ?? false;
  const storedValue = isSecret && value ? encryptSecret(value) : value;
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value: storedValue, ...extra },
    create: { key, value: storedValue, group: extra?.group ?? "general", type: extra?.type ?? "string", isSecret, ...extra },
  });
  return row;
}

/** حذف یک تنظیم (برای «بازگشت به پیش‌فرض» در پنل محدودیت‌ها) */
export async function deleteSetting(key: string) {
  cache.delete(key);
  await prisma.setting.deleteMany({ where: { key } });
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
