import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getCurrentUser } from "@/lib/auth/guards";

export const instant = false;

export const metadata = {
  title: "ورود سوپرادمین",
  description: "ورود اختصاصی مدیر سیستم با ایمیل و رمز عبور (بدون پیامک تأیید).",
  robots: { index: false, follow: false },
};

/** صفحهٔ ورود مجزای سوپرادمین — /admin/login */
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect("/admin");
  // کاربر غیرادمین که لاگین کرده به ورود عادی می‌رود تا رمز ادمین حدس زده نشود
  if (user) redirect("/dashboard");
  return <AdminLoginForm />;
}
