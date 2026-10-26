import { redirect } from "next/navigation";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import AdminVoiceBooking from "@/components/AdminVoiceBooking";
import PwaInstallButton from "@/components/PwaInstallButton";

export const instant = false;

export default async function VoiceBookingPage() {
  const user = await requirePageRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, timezone: true },
  });
  if (!salon) redirect("/dashboard/salon");

  return (
    <DashboardShell role={user.role} title="رزرو صوتی هوشمند">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            گفتار فارسی را به متن و نوبت تبدیل می‌کند. <Link href="/dashboard/new-appointment" className="font-bold text-pink-600 hover:underline dark:text-pink-400">ثبت دستی نوبت اینجاست</Link>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/new-appointment"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <PhoneCall className="h-5 w-5" /> رزرو دستی
            </Link>
            <PwaInstallButton />
          </div>
        </div>
        <AdminVoiceBooking salonId={salon.id} salonSlug={salon.slug} timezone={salon.timezone} />
      </div>
    </DashboardShell>
  );
}
