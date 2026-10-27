import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toPersianDigits, formatToman } from "@/lib/utils";
import SalonBooking from "@/components/SalonBooking";
import AssistantChat from "@/components/AssistantChat";
import FavoriteButton from "@/components/FavoriteButton";
import SafeImage from "@/components/SafeImage";
import SalonIcon from "@/components/icons/SalonIcon";
import type { Metadata } from "next";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return { title: "سالن یافت نشد" };
  const title = `${salon.name}${salon.city ? ` — آرایشگاه در ${salon.city}` : ""}`;
  const description =
    salon.description ??
    `رزرو آنلاین نوبت ${salon.name}${salon.city ? ` در ${salon.city}` : ""}؛ مشاهده خدمات، قیمت‌ها، آرایشگران و زمان‌های آزاد.`;
  const images = [salon.bannerUrl, salon.logoUrl].filter((u): u is string => Boolean(u));
  return {
    title,
    description,
    alternates: { canonical: `/s/${salon.slug}` },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      title,
      description,
      url: `/s/${salon.slug}`,
      siteName: "نوبینو",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
    robots: salon.isApproved && salon.isActive ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const salon = await prisma.salon.findUnique({
    where: { slug },
    include: {
      services: { where: { isActive: true } },
      galleryItems: { orderBy: { sortOrder: "asc" } },
      openingHours: true,
      staff: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          title: true,
          bio: true,
          avatarUrl: true,
          specialties: true,
          branchId: true,
          services: { select: { id: true } },
        },
      },
      branches: { where: { isActive: true }, select: { id: true, name: true, city: true, address: true } },
    },
  });

  if (!salon || !salon.isActive || !salon.isApproved) notFound();

  const [reviews, reviewAgg] = await Promise.all([
    prisma.review.findMany({
      where: { salonId: salon.id },
      include: { customer: { select: { name: true } }, staff: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.review.aggregate({ where: { salonId: salon.id }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const averageRating = Number((reviewAgg._avg.rating ?? 0).toFixed(1));
  const reviewCount = reviewAgg._count._all;

  const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  const schemaDays = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nobino.ir";
  const salonUrl = `${siteUrl.replace(/\/$/, "")}/s/${salon.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    description: salon.description ?? undefined,
    url: salonUrl,
    telephone: salon.phone || undefined,
    image: [salon.bannerUrl, salon.logoUrl].filter(Boolean),
    priceRange: salon.services.length
      ? `${Math.min(...salon.services.map((s) => s.price)).toLocaleString("fa-IR")} تا ${Math.max(
          ...salon.services.map((s) => s.price)
        ).toLocaleString("fa-IR")} تومان`
      : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: salon.city ?? undefined,
      streetAddress: salon.address ?? undefined,
      addressCountry: "IR",
    },
    openingHoursSpecification: salon.openingHours
      .filter((h) => !h.isClosed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${schemaDays[h.dayOfWeek] ?? "Saturday"}`,
        opens: h.openTime,
        closes: h.closeTime,
      })),
    makesOffer: salon.services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name, description: s.description ?? undefined },
      price: s.price,
      priceCurrency: "IRR",
    })),
    ...(reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating,
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.customer.name ?? "مشتری" },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.comment ?? undefined,
            datePublished: r.createdAt.toISOString().slice(0, 10),
          })),
        }
      : {}),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <AssistantChat salonId={salon.id} />
      {/* Header */}
      <header className="relative h-[18rem] w-full sm:h-80">
        <div
          className="absolute inset-0 animate-gradient"
          style={{ background: `linear-gradient(135deg, ${salon.coverColor}, #7c3aed)` }}
        />
        {/* بنر سالن؛ اگر سالن بنری آپلود نکرده، تصویر نمونهٔ برداری نمایش داده می‌شود */}
        <SafeImage
          src={salon.bannerUrl ?? "/seed/hero.svg"}
          alt={`بنر ${salon.name}`}
          className="absolute inset-0 hidden h-full w-full object-cover sm:block"
          fallback=""
          fallbackClassName="absolute inset-0 !bg-gradient-to-br !from-pink-500 !to-purple-700"
        />
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-6xl px-4 pb-6 sm:px-6 sm:pb-8">
          <div className="flex items-end gap-3 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white/70 bg-white/90 text-5xl shadow-2xl backdrop-blur sm:h-28 sm:w-28 sm:rounded-3xl">
              <SafeImage
                src={salon.logoUrl}
                alt={salon.name}
                className="h-full w-full rounded-xl object-contain sm:rounded-2xl"
                fallback={<SalonIcon className="h-10 w-10 sm:h-14 sm:w-14" />}
                fallbackClassName="h-full w-full rounded-xl sm:rounded-2xl"
              />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <h1 className="text-2xl font-black leading-tight drop-shadow sm:text-4xl">{salon.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85 sm:gap-x-4 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">📍 {salon.city} {salon.address}</span>
                <span className="inline-flex items-center gap-1.5" dir="ltr">📞 {toPersianDigits(salon.phone)}</span>
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-amber-200">
                    ★ <b>{toPersianDigits(averageRating)}</b> از ۵ — {toPersianDigits(reviewCount)} نظر
                  </span>
                )}
              </div>
            </div>
            <div className="ms-auto flex shrink-0 flex-col items-end gap-2">
              <FavoriteButton salonId={salon.id} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_380px]">
        {/* Main column */}
        <div className="order-2 space-y-8 sm:space-y-10 lg:order-1">
          <section>
            <h2 className="text-xl font-extrabold text-neutral-900">درباره سالن</h2>
            <p className="mt-3 leading-relaxed text-neutral-600">{salon.description ?? "توضیحی ثبت نشده است."}</p>
          </section>

          {salon.address && (
            <section>
              <h2 className="text-xl font-extrabold text-neutral-900">موقعیت روی نقشه</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
                <iframe
                  title="موقعیت سالن"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${salon.address} ${salon.city ?? ""}`)}&z=15&output=embed`}
                />
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-xl">✂️</span>
              <h2 className="text-xl font-extrabold text-neutral-900">خدمات</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {salon.services.map((s) => (
                <div key={s.id} className="group card-hover relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 opacity-0 transition group-hover:opacity-100 dark:from-pink-900/40 dark:to-purple-900/40" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-neutral-900 dark:text-neutral-100">{s.name}</h3>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        ⏱ {toPersianDigits(s.durationMin)} دقیقه
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-base font-black text-pink-600">{formatToman(s.price)}</div>
                      <div className="text-[10px] text-neutral-400">تومان</div>
                    </div>
                  </div>
                  {s.description && <p className="relative mt-3 text-sm text-neutral-500 dark:text-neutral-400">{s.description}</p>}
                </div>
              ))}
            </div>
          </section>

          {salon.staff.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold text-neutral-900">تیم آرایشگران</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {salon.staff.map((st) => (
                  <div key={st.id} className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-2xl dark:bg-pink-900/40">
                      <SafeImage
                        src={st.avatarUrl}
                        alt={st.name}
                        className="h-full w-full rounded-full object-cover"
                        fallback="✂️"
                        fallbackClassName="h-full w-full rounded-full text-2xl"
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-neutral-100">{st.name}</h3>
                      {st.title && <p className="text-xs text-pink-600">{st.title}</p>}
                      {st.specialties.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {st.specialties.map((sp) => (
                            <span key={sp} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                              {sp}
                            </span>
                          ))}
                        </div>
                      )}
                      {st.bio && <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{st.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {salon.galleryItems.length > 0 && (
            <section>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl">🖼️</span>
                <h2 className="text-xl font-extrabold text-neutral-900">گالری</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {salon.galleryItems.map((g) => (
                  <div key={g.id} className="group relative aspect-square overflow-hidden rounded-3xl bg-neutral-100 shadow-sm">
                    <SafeImage
                      src={g.imageUrl}
                      alt={g.title ?? salon.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      fallback="🖼️"
                      fallbackClassName="h-full w-full text-4xl"
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                      <span className="p-3 text-sm font-bold text-white">{g.title ?? ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section id="reviews">
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-extrabold text-neutral-900">نظرات مشتریان</h2>
              {reviewCount > 0 && (
                <span className="text-sm text-neutral-500">
                  میانگین <span className="font-bold text-amber-600">{toPersianDigits(averageRating)}</span> از ۵
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
                هنوز نظری ثبت نشده است. پس از مراجعه می‌توانید اولین نظر را ثبت کنید.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-neutral-800">{r.customer.name ?? "مشتری"}</div>
                      <div className="text-amber-500">
                        {"★".repeat(r.rating)}
                        <span className="text-neutral-200">{"★".repeat(5 - r.rating)}</span>
                      </div>
                    </div>
                    {r.staff?.name && <div className="text-[11px] text-neutral-400">آرایشگر: {r.staff.name}</div>}
                    {r.comment && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-400">
              فقط مشتریانی که نوبت «انجام‌شده» در این سالن دارند می‌توانند نظر ثبت کنند.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-neutral-900">ساعات کاری</h2>
            <ul className="mt-4 space-y-2">
              {salon.openingHours.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm dark:bg-neutral-900 dark:border dark:border-neutral-800">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{days[h.dayOfWeek]}</span>
                  {h.isClosed ? (
                    <span className="text-red-500">تعطیل</span>
                  ) : (
                    <span className="text-neutral-500" dir="ltr">
                      {toPersianDigits(h.openTime)} — {toPersianDigits(h.closeTime)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Booking widget */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <SalonBooking
            salonId={salon.id}
            slug={salon.slug}
            timezone={salon.timezone}
            maxAdvanceDays={salon.maxAdvanceDays}
            services={salon.services}
            staff={salon.staff}
            branches={salon.branches}
          />
        </aside>
      </div>
    </main>
  );
}
