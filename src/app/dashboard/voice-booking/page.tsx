import { redirect } from "next/navigation";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import AdminVoiceBooking from "@/components/AdminVoiceBooking";
import PwaInstallButton from "@/components/PwaInstallButton";

export const instant = false;

export default async function VoiceBookingPage() {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });
  if (!salon) redirect("/dashboard/salon");

  return (
    <DashboardShell role={user.role} title="رزرو صوتی هوشمند">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            گفتار فارسی را به متن و نوبت تبدیل می‌کند. <Link href="/dashboard/new-appointment" className="font-bold text-pink-600 hover:underline dark:text-pink-400">ثبت دستی نوبت اینجاست</Link>.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/new-appointment"
              className="hidden items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-600 transition hover:bg-neutral-50 sm:inline-flex dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <PhoneCall className="h-3.5 w-3.5" /> رزرو دستی
            </Link>
            <PwaInstallButton />
          </div>
        </div>
        <AdminVoiceBooking salonId={salon.id} salonSlug={salon.slug} />
      </div>
    </DashboardShell>
  );
}
