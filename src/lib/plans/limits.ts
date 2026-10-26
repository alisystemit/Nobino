import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

/**
 * محدودیت پلن‌های اشتراک (SaaS).
 *
 * اولویت تعیین هر محدودیت:
 * ۱) تنظیم اختصاصی همان پلن: `plan.limit.<PLAN>.<key>`
 * ۲) تنظیم عمومی (سازگاری با نسخه‌های قبلی): `plan.limit.<key>`
 * ۳) مقدار پیش‌فرض پلن
 */
export type PlanName = "FREE" | "BASIC" | "PRO" | "ENTERPRISE";

export type PlanLimits = {
  staff: number;
  branches: number;
  webapp: boolean;
  voiceBooking: boolean;
  csvExport: boolean;
  customDomain: boolean;
  smsReminders: boolean;
  api: boolean;
};

export const PLAN_ORDER: PlanName[] = ["FREE", "BASIC", "PRO", "ENTERPRISE"];

export const PLAN_LABELS: Record<PlanName, string> = {
  FREE: "رایگان",
  BASIC: "پایه",
  PRO: "حرفه‌ای",
  ENTERPRISE: "سازمانی",
};

/** ماتریس پیش‌فرض امکانات بر اساس پلن */
export const PLAN_DEFAULTS: Record<PlanName, PlanLimits> = {
  FREE: {
    staff: 5,
    branches: 2,
    webapp: true,
    voiceBooking: true,
    csvExport: true,
    customDomain: false,
    smsReminders: true,
    api: false,
  },
  BASIC: {
    staff: 15,
    branches: 5,
    webapp: true,
    voiceBooking: true,
    csvExport: true,
    customDomain: false,
    smsReminders: true,
    api: false,
  },
  PRO: {
    staff: 60,
    branches: 20,
    webapp: true,
    voiceBooking: true,
    csvExport: true,
    customDomain: true,
    smsReminders: true,
    api: true,
  },
  ENTERPRISE: {
    staff: 1000,
    branches: 200,
    webapp: true,
    voiceBooking: true,
    csvExport: true,
    customDomain: true,
    smsReminders: true,
    api: true,
  },
};

export function normalizePlan(value: string | null | undefined): PlanName {
  const upper = (value ?? "").toUpperCase();
  return (PLAN_ORDER as string[]).includes(upper) ? (upper as PlanName) : "FREE";
}

async function readOverride(plan: PlanName, key: keyof PlanLimits) {
  const scoped = await getSetting(`plan.limit.${plan}.${key}`);
  if (scoped != null && scoped !== "") return scoped;
  return getSetting(`plan.limit.${key}`);
}

/** محدودیت‌های یک پلن (با اعمال تنظیمات دست‌ی سوپرادمین) */
export async function getPlanLimitsForPlan(plan: PlanName): Promise<PlanLimits> {
  const defaults = PLAN_DEFAULTS[plan];

  const num = async (key: "staff" | "branches") => {
    const raw = await readOverride(plan, key);
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaults[key];
  };
  const bool = async (key: Exclude<keyof PlanLimits, "staff" | "branches">) => {
    const raw = await readOverride(plan, key);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return defaults[key];
  };

  return {
    staff: await num("staff"),
    branches: await num("branches"),
    webapp: await bool("webapp"),
    voiceBooking: await bool("voiceBooking"),
    csvExport: await bool("csvExport"),
    customDomain: await bool("customDomain"),
    smsReminders: await bool("smsReminders"),
    api: await bool("api"),
  };
}

/** محدودیت‌های پلن جاری یک سالن (اگر salonId ندهید، پلن رایگان برمی‌گردد) */
export async function getPlanLimits(salonId?: string): Promise<PlanLimits> {
  let plan: PlanName = "FREE";
  if (salonId) {
    const salon = await prisma.salon.findUnique({ where: { id: salonId }, select: { plan: true } });
    plan = normalizePlan(salon?.plan);
  }
  return getPlanLimitsForPlan(plan);
}

/** پلن جاری سالن (برای نمایش در پنل و صفحه پکیج‌ها) */
export async function getSalonPlan(salonId: string) {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: {
      plan: true,
      subscriptions: {
        where: { status: "ACTIVE", endsAt: { gt: new Date() } },
        orderBy: { endsAt: "desc" },
        take: 1,
        select: { endsAt: true, autoRenew: true, package: { select: { id: true, name: true } } },
      },
    },
  });
  const plan = normalizePlan(salon?.plan);
  return {
    plan,
    label: PLAN_LABELS[plan],
    limits: await getPlanLimits(salonId),
    subscription: salon?.subscriptions[0] ?? null,
  };
}

/**
 * بررسی اینکه سالن هنوز مجاز به افزودن آیتم جدید است یا این امکان را دارد.
 * برای کلیدهای عددی، تعداد فعلی با سقف پلن مقایسه می‌شود.
 */
export async function withinLimit(
  salonId: string,
  key: keyof PlanLimits
): Promise<boolean> {
  const limits = await getPlanLimits(salonId);
  const limit = limits[key];
  if (typeof limit === "boolean") return limit;

  let count = 0;
  if (key === "staff") count = await prisma.staff.count({ where: { salonId, isActive: true } });
  else if (key === "branches") count = await prisma.branch.count({ where: { salonId, isActive: true } });

  return count < limit;
}
