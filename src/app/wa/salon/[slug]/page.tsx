import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SalonBooking from "@/components/SalonBooking";
import WebAppScript from "@/components/WebAppScript";
import SalonIcon from "@/components/icons/SalonIcon";
import type { Metadata } from "next";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const salon = await prisma.salon.findUnique({ where: { slug } });
  return { title: `${salon?.name ?? "سالن"} | نوبت صوتی` };
}

export default async function WaSalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const salon = await prisma.salon.findUnique({
    where: { slug },
    include: {
      services: { where: { isActive: true } },
      staff: { where: { isActive: true }, select: { id: true, name: true, title: true } },
      branches: { where: { isActive: true }, select: { id: true, name: true, city: true } },
    },
  });
  if (!salon || !salon.isActive) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <WebAppScript />
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logoUrl} alt="" className="h-full w-full rounded-xl object-cover" />
          ) : (
            <SalonIcon className="h-8 w-8 text-neutral-400" />
          )}
        </div>
        <div>
          <h1 className="text-lg font-black text-neutral-900">{salon.name}</h1>
          <p className="text-xs text-neutral-500">{salon.city} {salon.address}</p>
        </div>
      </div>

      <SalonBooking salonId={salon.id} slug={salon.slug} services={salon.services} staff={salon.staff} branches={salon.branches} />

      <p className="mt-6 text-center text-xs text-neutral-400">
        نوبینو — برای استفاده در تلگرام، ایتا و بله
      </p>
    </main>
  );
}
