import Link from "next/link";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import HomeHero from "@/components/HomeHero";

const features = [
  { icon: "🎙️", title: "نوبت‌دهی صوتی", desc: "مشتری با میکروفون به فارسی نوبت می‌گیرد؛ هوش مصنوعی گفتار را به متن تبدیل و ثبت می‌کند.", grad: "from-pink-500 to-rose-500" },
  { icon: "📲", title: "پیامک یادآوری", desc: "در زمان مقرر، پیامک خودکار برای حضور در آرایشگاه ارسال می‌شود.", grad: "from-purple-500 to-indigo-500" },
  { icon: "🪞", title: "صفحه و دامنه مجزا", desc: "هر آرایشگاه یک صفحه و ساب‌دامین اختصاصی برای نوبت، گالری و خدمات دارد.", grad: "from-emerald-500 to-teal-500" },
  { icon: "💳", title: "مدیریت مالی دقیق", desc: "کیف پول، کمیسیون درصدی نمایندگان و گزارش مالی شفاف برای همه نقش‌ها.", grad: "from-amber-500 to-orange-500" },
  { icon: "🏦", title: "۲۰ درگاه پرداخت", desc: "فروش پکیج با زرین‌پال، ملت، سامان، پاسارگاد و ۱۶ درگاه ایرانی دیگر.", grad: "from-sky-500 to-blue-500" },
  { icon: "💬", title: "وب‌اپ پیام‌رسان‌ها", desc: "قابل افزودن به وب‌اپ تلگرام، ایتا، بله و سایر پیام‌رسان‌ها.", grad: "from-fuchsia-500 to-pink-500" },
  { icon: "🏢", title: "چند شعبه", desc: "مدیریت چند شعبه با کارکنان، صندوق و نوبت‌های مستقل.", grad: "from-lime-500 to-green-500" },
  { icon: "📊", title: "گزارش و تحلیل", desc: "نمودار درآمد، گزارش مالی بازه‌ای و تحلیل هوش مصنوعی کسب‌وکار.", grad: "from-cyan-500 to-sky-500" },
  { icon: "🎁", title: "وفاداری و هدیه", desc: "امتیاز مشتری، کارت هدیه، صف انتظار هوشمند و دستگاهین بازاریابی.", grad: "from-violet-500 to-purple-500" },
];

const steps = [
  { icon: "1️⃣", title: "سالن خود را بسازید", desc: "در کمتر از یک دقیقه صفحه اختصاصی سالن را با خدمات، کارکنان و شعبه‌ها راه‌اندازی کنید." },
  { icon: "2️⃣", title: "مشتری با صدا نوبت می‌گیرد", desc: "مشتری با میکروفون فارسی نوبت می‌گیرد؛ سیستم همه‌چیز را خودکار ثبت می‌کند." },
  { icon: "3️⃣", title: "یادآوری و مدیریت", desc: "پیامک یادآوری خودکار، تقویم، گزارش مالی و تحلیل عملکرد در دسترس شماست." },
];

const testimonials = [
  { name: "نگار رضایی", role: "مدیر سالن زیبایی ماه", text: "با نوبینو وقت‌های خالی سالن پر شد و مشتری‌ها از رزرو صوتی لذت می‌برند.", avatar: "✂️" },
  { name: "امیر محمدی", role: "نماینده فروش", text: "کمیسیون و تسویه کاملاً خودکار و شفاف است؛ همه‌چیز در یک پنل.", avatar: "🤝" },
  { name: "سارا احمدی", role: "مشتری", text: "خیلی راحت با صدا نوبت گرفتم و پیامک یادآوری هم گرفت. عالی بود!", avatar: "🌸" },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      <AnnouncementBanner />
      <HomeHero />

      {/* ویژگی‌ها */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <span className="inline-block rounded-full bg-pink-50 px-4 py-1.5 text-sm font-bold text-pink-600">امکانات</span>
          <h2 className="mt-4 text-3xl font-black text-neutral-900 sm:text-4xl">هر آنچه یک آرایشگاه نیاز دارد</h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-500">یک پلتفرم کامل برای نوبت، مشتری، امور مالی و رشد کسب‌وکار شما.</p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group card-hover relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${f.grad} opacity-10 transition group-hover:scale-150`} />
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${f.grad} text-2xl text-white shadow-lg`}>
                {f.icon}
              </div>
              <h3 className="relative mt-5 text-lg font-extrabold text-neutral-900 dark:text-neutral-100">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* مراحل */}
      <section className="bg-gradient-to-b from-purple-50/60 to-white py-20 dark:from-neutral-900 dark:to-neutral-950">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-neutral-100">در ۳ قدم شروع کنید</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="relative rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-3xl shadow-lg shadow-pink-500/30">
                  {s.icon}
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* نظرات */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-black text-neutral-900 dark:text-neutral-100">مشتریان چه می‌گویند؟</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="card-hover rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-yellow-400">★★★★★</div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">“{t.text}”</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100 text-xl dark:from-pink-900/40 dark:to-purple-900/40">{t.avatar}</div>
                <div>
                  <div className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">{t.name}</div>
                  <div className="text-xs text-neutral-400">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-bl from-pink-600 via-rose-600 to-purple-700 px-8 py-16 text-center text-white shadow-2xl shadow-pink-500/30">
          <div className="absolute inset-0 bg-hero-pattern" />
          <div className="relative">
            <h2 className="text-3xl font-black sm:text-4xl">آماده‌اید سالن خود را دیجیتال کنید؟</h2>
            <p className="mx-auto mt-3 max-w-lg text-rose-100/90">همین حالا شروع کنید؛ بدون کارت بانکی و با دوره آزمایشی رایگان.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login" className="rounded-2xl bg-white px-8 py-4 text-base font-black text-rose-600 shadow-xl transition hover:scale-105">
                شروع رایگان 🚀
              </Link>
              <Link href="/salons" className="rounded-2xl border border-white/40 bg-white/10 px-8 py-4 text-base font-bold backdrop-blur transition hover:bg-white/20">
                مشاهده نمونه
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white">🪞</span>
                <span className="text-lg font-black text-neutral-900 dark:text-neutral-100">نوبینو</span>
              </div>
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">نوبت‌دهی هوشمند آرایشگاه با هوش مصنوعی صوتی.</p>
            </div>
            <div>
              <div className="text-sm font-extrabold text-neutral-800 dark:text-neutral-200">دسترسی سریع</div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/salons" className="hover:text-pink-600">جستجوی آرایشگاه‌ها</Link>
                <Link href="/packages" className="hover:text-pink-600">پکیج‌ها</Link>
                <Link href="/login" className="hover:text-pink-600">ورود</Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-extrabold text-neutral-800 dark:text-neutral-200">تماس</div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span>support@nobino.ir</span>
                <span dir="ltr">۰۲۱-۱۲۰۰۰۰۰۰</span>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-400 dark:border-neutral-800">
            © 1405 نوبینو — نوبت‌دهی هوشمند آرایشگاه
          </div>
        </div>
      </footer>
    </main>
  );
}
