import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import DashboardNav from "@/components/DashboardNav";
import AccountPanel from "@/components/AccountPanel";

export const instant = false;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-neutral-50">
      <DashboardNav role={user.role} />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-black text-neutral-900">حساب من</h1>
        <p className="mt-1 text-sm text-neutral-500">
          نوبت‌ها، تاریخچه مراجعات، علاقه‌مندی‌ها، نظرات و امنیت حساب شما در یک‌جا.
        </p>
        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <AccountPanel
            initialMe={{
              id: user.id,
              phone: user.phone,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: user.role,
            }}
          />
        </div>
      </div>
    </main>
  );
}
