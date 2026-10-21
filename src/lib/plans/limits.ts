import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

/**
 * محدودیت پلن‌های اشتراک (SaaS). مقدار پیش‌فرض هر محدودیت را
 * می‌توان از تنظیمات پویا (`plan.limit.<key>`) تغییر داد.
 */
export type PlanLimits = {
  staff: number;
  branches: number;
  webapp: boolean;
  voiceBooking: boolean;
  csvExport: boolean;
  customDomain: boolean;
};

const DEFAULTS: Record<string, number | boolean> = {
  staff: 100,
  branches: 50,
  webapp: true,
  voiceBooking: true,
  csvExport: true,
  customDomain: false,
};

export async function getPlanLimits(): Promise<PlanLimits> {
  const num = async (key: string, def: number) => {
    const v = await getSetting(`plan.limit.${key}`);
    return v != null ? Number(v) : def;
  };
  const bool = async (key: string, def: boolean) => {
    const v = await getSetting(`plan.limit.${key}`);
    return v === "true" ? true : v === "false" ? false : def;
  };

  return {
    staff: await num("staff", DEFAULTS.staff as number),
    branches: await num("branches", DEFAULTS.branches as number),
    webapp: await bool("webapp", DEFAULTS.webapp as boolean),
    voiceBooking: await bool("voiceBooking", DEFAULTS.voiceBooking as boolean),
    csvExport: await bool("csvExport", DEFAULTS.csvExport as boolean),
    customDomain: await bool("customDomain", DEFAULTS.customDomain as boolean),
  };
}

/** بررسی اینکه سالن هنوز به سقف خدمات مجاز خود نرسیده است */
export async function withinLimit(salonId: string, key: keyof PlanLimits): Promise<boolean> {
  const limits = await getPlanLimits();
  const limit = limits[key];
  if (typeof limit === "boolean") return limit;

  let count = 0;
  if (key === "staff") count = await prisma.staff.count({ where: { salonId, isActive: true } });
  else if (key === "branches") count = await prisma.branch.count({ where: { salonId, isActive: true } });

  return count < limit;
}
