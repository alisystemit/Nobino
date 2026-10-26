import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import { listOwnerSalons, resolveDashboardSalonId } from "@/lib/salons";
import { UNLIMITED_FROM } from "@/lib/plans/limit-defs";
import { limitSnapshot } from "@/lib/plans/limits";
import SalonSettings from "@/components/SalonSettings";
import CreateSalon from "@/components/CreateSalon";
import SalonManager from "@/components/SalonManager";
import DailyStats from "@/components/DailyStats";
import DailyBoard from "@/components/DailyBoard";
import DashboardShell from "@/components/DashboardShell";
import { StatCard, PanelCard, Badge } from "@/components/ui/Stats";
import { CalendarDays, Scissors, Images, Star, Settings, Rocket, ClipboardList, Mic, Store, Gauge, Plus } from "lucide-react";

export const instant = false;

const planLabels: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "brand" }> = {
  FREE: { label: "پلن رایگان", tone: "neutral" },
  BASIC: { label: "پلن پایه", tone: "neutral" },
  PRO: { label: "پلن حرفه‌ای", tone: "warning" },
  ENTERPRISE: { label: "پلن سازمانی", tone: "success" },
};

function faDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(d);
}

export default async function SalonDashboardPage({ searchParams }: { searchParams: Promise<{ salon?: string; new?: string }> }) {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const sp = await searchParams;
  const mySalons = await listOwnerSalons(user.id);

  // «ساخت سالن جدید» از سوییچر — تا سقف تعداد سالن پلن (خطای سقف از API می‌آید)
  if (sp.new === "1" && mySalons.length > 0) {
    return (
      <DashboardShell role={user.role} title="ساخت سالن">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">ساخت سالن جدید</h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">
            در حال حاضر {toPersianDigits(mySalons.length)} سالن دارید. سقف پلن شما از بخش اشتراک قابل ارتقاست.
          </p>
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <CreateSalon />
          </div>
          <Link href="/dashboard/salon" className="mt-4 inline-block text-sm font-bold text-pink-600 hover:underline">
            بازگشت به سالن‌ها
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const salonId = await resolveDashboardSalonId(user.id, sp.salon ?? null, user.role === "ADMIN");
  const salon = salonId
    ? await prisma.salon.findUnique({
        where: { id: salonId },
        include: { services: true, _count: { select: { appointments: true, galleryItems: true, reviews: true } } },
      })
    : null;

  if (!salon) {
    return (
      <DashboardShell role={user.role} title="ساخت سالن">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">ساخت سالن</h1>
          <p className="mt-2 text-neutral-500 dark:text-neutral-400">هنوز سالنی ندارید. همین حالا بسازید:</p>
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <CreateSalon />
          </div>
        </div>
      </DashboardShell>
    );
  }

  const plan = planLabels[salon.plan] ?? planLabels.FREE;
  const subEnd = faDate(salon.subscriptionEndsAt);
  const trialEnd = faDate(salon.trialEndsAt);
  const today = new Date();
  const subActive = salon.subscriptionEndsAt ? salon.subscriptionEndsAt > today : false;
  // وضعیت مصرف سقف‌ها — همه از کاتالوگ محدودیت‌ها و تنظیمات سوپرادمین می‌آید
  const snap = await limitSnapshot(salon.id);

  return (
    <DashboardShell role={user.role} title="سالن من">
      {/* نوار وضعیت سالن */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-l from-[#1c2434] to-[#2a3450] p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black sm:text-2xl">{salon.name}</h1>
              <Badge tone={plan.tone}>{plan.label}</Badge>
              {!salon.isApproved && <Badge tone="warning">در انتظار تأیید</Badge>}
              {!salon.isActive && <Badge tone="danger">غیرفعال</Badge>}
              {subActive && <Badge tone="success">اشتراک فعال</Badge>}
            </div>
            <p className="mt-2 text-sm text-neutral-300">
              صفحه: <span dir="ltr" className="font-mono">nobino.ir/s/{salon.slug}</span>
              <span className="mx-2 text-neutral-500">|</span>
              تلفن: {toPersianDigits(salon.phone)}
            </p>
            {(subEnd || trialEnd) && (
              <p className="mt-1 text-xs text-neutral-400">
                {subEnd ? `اشتراک تا ${subEnd}${salon.autoRenew ? " (تمدید خودکار)" : ""}` : ""}
                {!subEnd && trialEnd ? `دوره آزمایشی تا ${trialEnd}` : ""}
              </p>
            )}
          </div>
          <Link
            href={`/s/${salon.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#1c2434] shadow-xl transition hover:scale-[1.03]"
          >
            <Store className="h-4 w-4" />
            مشاهده صفحه عمومی
          </Link>
        </div>
      </div>

      {/* سوییچر سالن‌ها — فقط وقتی کاربر بیش از یک سالن دارد */}
      {mySalons.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="px-1 text-xs font-bold text-neutral-500">سالن‌های من:</span>
          {mySalons.map((s) => {
            const active = s.id === salon.id;
            return (
              <Link
                key={s.id}
                href={`/dashboard/salon?salon=${s.id}`}
                className={`rounded-xl px-3.5 py-1.5 text-sm font-bold transition ${
                  active
                    ? "bg-[#1c2434] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {s.name}
              </Link>
            );
          })}
          <Link
            href="/dashboard/salon?new=1"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-pink-300 px-3.5 py-1.5 text-sm font-bold text-pink-600 transition hover:bg-pink-50 dark:hover:bg-pink-950/40"
          >
            <Plus className="h-4 w-4" />
            سالن جدید
          </Link>
        </div>
      )}

      <DailyStats role={user.role} />

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="مجموع نوبت‌ها" value={toPersianDigits(salon._count.appointments)} icon={<CalendarDays className="h-5 w-5" />} sub="کل نوبت‌های ثبت‌شده" />
        <StatCard label="خدمات فعال" value={toPersianDigits(salon.services.length)} icon={<Scissors className="h-5 w-5" />} iconClass="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300" sub="در صفحه عمومی سالن" />
        <StatCard label="آثار گالری" value={toPersianDigits(salon._count.galleryItems)} icon={<Images className="h-5 w-5" />} iconClass="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" sub="نمونه‌کارهای نمایشی" />
        <StatCard label="نظرات مشتریان" value={toPersianDigits(salon._count.reviews)} icon={<Star className="h-5 w-5" />} iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" sub="امتیاز و بازخورد صفحه" />
      </div>

      {/* برنامه امروز */}
      <div className="mt-6">
        <PanelCard
          title="برنامه امروز"
          subtitle="نوبت‌های روزانه با ساعت، وضعیت و یادآوری پیامکی"
          icon={<ClipboardList className="h-5 w-5" />}
          action={
            <Link
              href="/dashboard/voice-booking"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1c2434] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#2a3450]"
            >
              <Mic className="h-4 w-4" />
              صفحه رزرو صوتی
            </Link>
          }
          bodyClassName="p-5"
        >
          <DailyBoard salonId={salon.id} />

          {/* نوار اکشن ثبت نوبت */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-purple-600 to-pink-600 p-5 text-white shadow-lg shadow-pink-500/20">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl backdrop-blur">🎙️</span>
              <div>
                <div className="text-base font-black">ثبت نوبت دستی با صوت</div>
                <div className="mt-0.5 text-xs text-white/80">نوبت جدید را دستی وارد کنید یا با ضبط صدا، هوش مصنوعی اطلاعات را استخراج و ثبت کند</div>
              </div>
            </div>
            <Link
              href="/dashboard/voice-booking"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-rose-600 shadow-xl transition hover:scale-[1.03]"
            >
              <Mic className="h-4 w-4" />
              + ثبت نوبت جدید
            </Link>
          </div>
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PanelCard
            title="تنظیمات سالن"
            subtitle="اطلاعات عمومی، ساعات کاری، قوانین رزرو و دامنه اختصاصی"
            icon={<Settings className="h-5 w-5" />}
          >
            <SalonSettings
              salon={{
                id: salon.id,
                name: salon.name,
                slug: salon.slug,
                phone: salon.phone,
                city: salon.city,
                address: salon.address,
                description: salon.description,
                coverColor: salon.coverColor,
                isActive: salon.isActive,
                logoUrl: salon.logoUrl,
                bannerUrl: salon.bannerUrl,
                timezone: salon.timezone,
                latitude: salon.latitude,
                longitude: salon.longitude,
                customDomain: salon.customDomain,
                minNoticeMinutes: salon.minNoticeMinutes,
                maxAdvanceDays: salon.maxAdvanceDays,
                cancelDeadlineHours: salon.cancelDeadlineHours,
                bufferMinutes: salon.bufferMinutes,
              }}
            />
          </PanelCard>
        </div>

        <div className="flex flex-col gap-5">
          <PanelCard
            title="مصرف پلن"
            subtitle={`سقف‌های ${snap.planLabel} — هر سقف در پنل سوپرادمین قابل تغییر است`}
            icon={<Gauge className="h-5 w-5" />}
          >
            <div className="space-y-3">
              {snap.counts.map((c) => {
                const unlimited = c.limit >= UNLIMITED_FROM;
                const pct = unlimited ? 8 : Math.min(100, Math.round((c.used / Math.max(1, c.limit)) * 100));
                const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-300">
                      <span>
                        {c.icon} {c.label}
                      </span>
                      <span className="text-neutral-400">
                        {unlimited ? "نامحدود" : `${toPersianDigits(c.used)} / ${toPersianDigits(c.limit)}`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {snap.bools.map((b) => (
                <span
                  key={b.key}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    b.on
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800"
                  }`}
                >
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
            <Link href="/packages" className="mt-4 inline-block text-xs font-bold text-pink-600 hover:underline">
              ارتقا برای افزایش سقف‌ها ←
            </Link>
          </PanelCard>

          <PanelCard title="نظرات مشتریان" subtitle="امتیاز و بازخورد صفحه عمومی" icon={<Star className="h-5 w-5" />}>
            <div className="text-3xl font-black text-neutral-900 dark:text-neutral-100">{toPersianDigits(salon._count.reviews)}</div>
            <div className="mt-1 text-sm text-neutral-500">نظر ثبت‌شده</div>
            <Link
              href={`/s/${salon.slug}#reviews`}
              className="mt-4 inline-block rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              مشاهده نظرات
            </Link>
          </PanelCard>

          <PanelCard title="اشتراک و پلن" subtitle="ارتقا یا تمدید اشتراک" icon={<Rocket className="h-5 w-5" />}>
            <div className="text-sm font-black text-neutral-900 dark:text-neutral-100">{plan.label}</div>
            {subEnd && <div className="mt-1 text-xs text-neutral-500">اشتراک تا {subEnd}</div>}
            <Link
              href="/packages"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-pink-600 to-purple-600 px-4 py-2 text-sm font-bold text-white transition hover:scale-[1.02]"
            >
              <Rocket className="h-4 w-4" />
              ارتقای پلن
            </Link>
          </PanelCard>
        </div>
      </div>

      <div className="mt-6">
        <PanelCard
          title="مدیریت سالن"
          subtitle="خدمات، کارکنان، مشتریان، تقویم، صندوق، گزارش و کمپین‌ها"
          icon={<Store className="h-5 w-5" />}
        >
          <SalonManager salonId={salon.id} salonSlug={salon.slug} />
        </PanelCard>
      </div>
    </DashboardShell>
  );
}
