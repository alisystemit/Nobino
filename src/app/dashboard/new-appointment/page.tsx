import { redirect } from "next/navigation";
import Link from "next/link";
import { Mic } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import ManualBooking from "@/components/ManualBooking";
import PwaInstallButton from "@/components/PwaInstallButton";

export const instant = false;

export default async function ManualBookingPage() {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!salon) redirect("/dashboard/salon");

  return (
    <DashboardShell role={user.role} title="رزرو دستی">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            نوبت را تایپ کنید — مناسب مشتری تلفنی یا حضوری. <Link href="/dashboard/voice-booking" className="font-bold text-pink-600 hover:underline dark:text-pink-400">رزرو صوتی هوشمند اینجاست</Link>.
          </p>
          <PwaInstallButton />
        </div>
        <ManualBooking salonId={salon.id} />
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-400">
          <Mic className="h-3.5 w-3.5" />
          این صفحه مستقل از رزرو صوتی است؛ هیچ بخشی از آن به میکروفون نیاز ندارد و روی http هم کامل کار می‌کند.
        </p>
      </div>
    </DashboardShell>
  );
}
