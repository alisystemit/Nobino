import Link from "next/link";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import HomeHero from "@/components/HomeHero";

const features = [
  {
    title: "نوبت‌دهی صوتی",
    desc: "مشتری با میکروفون به فارسی نوبت می‌گیرد؛ هوش مصنوعی گفتار را به متن تبدیل و ثبت می‌کند.",
    icon: "🎙️",
  },
  {
    title: "پیامک یادآوری",
    desc: "در زمان مقرر، پیامک خودکار برای حضور در آرایشگاه ارسال می‌شود.",
    icon: "📲",
  },
  {
    title: "صفحه و ساب‌دامین مجزا",
    desc: "هر آرایشگاه یک صفحه و دامنه اختصاصی برای نوبت، گالری و خدمات خود دارد.",
    icon: "🪞",
  },
  {
    title: "مدیریت مالی دقیق",
    desc: "کیف پول، کمیسیون درصدی نمایندگان و گزارش مالی شفاف برای آرایشگر، نماینده و ادمین.",
    icon: "💳",
  },
  {
    title: "۱۵ درگاه پرداخت",
    desc: "فروش پکیج با زرین‌پال، ملت، سامان، پارسیان، پاسارگاد و بیش از ۱۵ درگاه ایرانی.",
    icon: "🏦",
  },
  {
    title: "وب‌اپ پیام‌رسان‌ها",
    desc: "قابل افزودن به وب‌اپ تلگرام، ایتا، بله و سایر پیام‌رسان‌ها.",
    icon: "💬",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      <AnnouncementBanner />
      <HomeHero />

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-neutral-900">هر آنچه یک آرایشگاه نیاز دارد</h2>
          <p className="mt-3 text-neutral-500">یک پلتفرم کامل برای مدیریت نوبت، مشتری و امور مالی</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gateways */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-extrabold text-neutral-900">بیش از ۱۵ درگاه پرداخت ایرانی</h2>
          <p className="mt-2 text-neutral-500">
            زرین‌پال، ملت، سامان، پارسیان، پاسارگاد، آسان‌پرداخت، ایران‌کیش، سداد،
            مبناکارت، سی‌تاب، پرداخت‌نت، PSP، نکست‌پی، ونکی و بیشتر
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-neutral-500">
          © ۱۴۰۴ نوبینو — نوبت‌دهی هوشمند آرایشگاه
        </div>
      </footer>
    </main>
  );
}
