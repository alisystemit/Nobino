"use client";

/** دکمه خروج از حساب: نشست سرور را حذف و کوکی را پاک می‌کند. */
export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.href = "/";
        }
      }}
      className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
    >
      خروج
    </button>
  );
}
