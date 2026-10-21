import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { toPersianDigits } from "@/lib/utils";
import SalonSettings from "@/components/SalonSettings";
import CreateSalon from "@/components/CreateSalon";
import SalonManager from "@/components/SalonManager";
import DailyStats from "@/components/DailyStats";

export const instant = false;

export default async function SalonDashboardPage() {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findUnique({
    where: { ownerId: user.id },
    include: { services: true, _count: { select: { appointments: true, galleryItems: true } } },
  });

  if (!salon) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-black text-neutral-900">ساخت سالن</h1>
        <p className="mt-2 text-neutral-500">هنوز سالنی ندارید. همین حالا بسازید:</p>
        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <CreateSalon />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <DailyStats role={user.role} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">سالن من</h1>
          <p className="mt-1 text-neutral-500">
            بسیاریلاگ: <span dir="ltr" className="font-mono">{salon.slug}</span> — تلفن: {toPersianDigits(salon.phone)}
          </p>
        </div>
        <Link
          href={`/s/${salon.slug}`}
          className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          مشاهده صفحه عمومی
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Statistics */}
        <div className="grid gap-4 lg:col-span-1">
          <Stat label="مجموع نوبت‌ها" value={toPersianDigits(salon._count.appointments)} />
          <Stat label="خدمات" value={toPersianDigits(salon.services.length)} />
          <Stat label="آثار گالری" value={toPersianDigits(salon._count.galleryItems)} />
        </div>

        {/* Settings */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-extrabold text-neutral-900">تنظیمات سالن</h2>
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

      {/* مدیریت (خدمات/کارکنان/مسدودسازی/نوبت دستی) */}
      <div className="mt-10 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-neutral-900">مدیریت سالن</h2>
        <div className="mt-6">
          <SalonManager salonId={salon.id} salonSlug={salon.slug} />
        </div>
      </div>
    </main>
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
