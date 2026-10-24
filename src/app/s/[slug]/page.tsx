import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toPersianDigits, formatToman } from "@/lib/utils";
import SalonBooking from "@/components/SalonBooking";
import AssistantChat from "@/components/AssistantChat";
import FavoriteButton from "@/components/FavoriteButton";
import type { Metadata } from "next";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const salon = await prisma.salon.findUnique({ where: { slug } });
  return {
    title: salon?.name ?? "سالن",
    description: salon?.description ?? undefined,
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
      staff: { where: { isActive: true }, select: { id: true, name: true, title: true, bio: true, avatarUrl: true, specialties: true, branchId: true } },
      branches: { where: { isActive: true }, select: { id: true, name: true, city: true, address: true } },
    },
  });

  if (!salon || !salon.isActive) notFound();

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

  return (
    <main>
      <AssistantChat salonId={salon.id} />
      {/* Header */}
      <header className="relative h-80 w-full">
        <div
          className="absolute inset-0 animate-gradient"
          style={
            salon.bannerUrl
              ? { backgroundImage: `url(${salon.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${salon.coverColor}, #7c3aed)` }
          }
        />
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-6xl px-6 pb-8">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-white/70 bg-white/90 text-5xl shadow-2xl backdrop-blur">
              {salon.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={salon.logoUrl} alt={salon.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                "🪞"
              )}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <h1 className="text-3xl font-black drop-shadow sm:text-4xl">{salon.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                <span className="inline-flex items-center gap-1.5">📍 {salon.city} {salon.address}</span>
                <span className="inline-flex items-center gap-1.5" dir="ltr">📞 {toPersianDigits(salon.phone)}</span>
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-amber-200">
                    ★ <b>{toPersianDigits(averageRating)}</b> از ۵ — {toPersianDigits(reviewCount)} نظر
                  </span>
                )}
              </div>
            </div>
            <div className="ms-auto flex flex-col items-end gap-2">
              <FavoriteButton salonId={salon.id} />
              {reviewCount > 0 && (
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  ★ {toPersianDigits(averageRating)} / ۵
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
        {/* Main column */}
        <div className="space-y-10">
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-xl">💇‍♀️</span>
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
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pink-100 text-2xl dark:bg-pink-900/40">
                      {st.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={st.avatarUrl} alt={st.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        "💇‍♀️"
                      )}
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
                    <img
                      src={g.imageUrl}
                      alt={g.title ?? ""}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
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
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SalonBooking
            salonId={salon.id}
            slug={salon.slug}
            services={salon.services}
            staff={salon.staff}
            branches={salon.branches}
          />
        </aside>
      </div>
    </main>
  );
}
