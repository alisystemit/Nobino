import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import SalonSettings from "@/components/SalonSettings";
import CreateSalon from "@/components/CreateSalon";
import SalonManager from "@/components/SalonManager";
import DailyStats from "@/components/DailyStats";
import DashboardShell from "@/components/DashboardShell";

export const instant = false;

export default async function SalonDashboardPage() {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findUnique({
    where: { ownerId: user.id },
    include: { services: true, _count: { select: { appointments: true, galleryItems: true } } },
  });

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

  return (
    <DashboardShell role={user.role} title="سالن من">
      <DailyStats role={user.role} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            اسلاگ: <span dir="ltr" className="font-mono">/{salon.slug}</span> — تلفن: {toPersianDigits(salon.phone)}
          </p>
        </div>
        <Link href={`/s/${salon.slug}`} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900">
          مشاهده صفحه عمومی
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-1">
          <Stat label="مجموع نوبت‌ها" value={toPersianDigits(salon._count.appointments)} />
          <Stat label="خدمات" value={toPersianDigits(salon.services.length)} />
          <Stat label="آثار گالری" value={toPersianDigits(salon._count.galleryItems)} />
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">تنظیمات سالن</h2>
          <div className="mt-6">
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
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">مدیریت سالن</h2>
        <div className="mt-6">
          <SalonManager salonId={salon.id} salonSlug={salon.slug} />
        </div>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-2xl font-black text-pink-600">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}
