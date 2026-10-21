import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toPersianDigits, formatToman } from "@/lib/utils";
import SalonBooking from "@/components/SalonBooking";
import AssistantChat from "@/components/AssistantChat";
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
      staff: { where: { isActive: true }, select: { id: true, name: true, title: true, bio: true, avatarUrl: true, specialties: true } },
    },
  });

  if (!salon || !salon.isActive) notFound();

  const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

  return (
    <main>
      <AssistantChat salonId={salon.id} />
      {/* Header */}
      <header className="relative h-72 w-full">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${salon.coverColor}, #7c3aed)` }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-5xl px-6 pb-8">
          <div className="flex items-end gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white text-4xl shadow-lg">
              {salon.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={salon.logoUrl} alt={salon.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                "🪞"
              )}
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-black">{salon.name}</h1>
              <p className="mt-1 text-white/80">
                {salon.city} {salon.address}
              </p>
              <p className="mt-1 text-sm" dir="ltr">
                {toPersianDigits(salon.phone)}
              </p>
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
            <h2 className="text-xl font-extrabold text-neutral-900">خدمات</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {salon.services.map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-900">{s.name}</h3>
                    <span className="text-sm font-semibold text-pink-600">{formatToman(s.price)}</span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    مدت: {toPersianDigits(s.durationMin)} دقیقه
                    {s.description ? ` — ${s.description}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {salon.staff.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold text-neutral-900">تیم آرایشگران</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {salon.staff.map((st) => (
                  <div key={st.id} className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pink-100 text-2xl">
                      {st.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={st.avatarUrl} alt={st.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        "💇‍♀️"
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">{st.name}</h3>
                      {st.title && <p className="text-xs text-pink-600">{st.title}</p>}
                      {st.specialties.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {st.specialties.map((sp) => (
                            <span key={sp} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-600">
                              {sp}
                            </span>
                          ))}
                        </div>
                      )}
                      {st.bio && <p className="mt-2 text-sm text-neutral-500">{st.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {salon.galleryItems.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold text-neutral-900">گالری</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {salon.galleryItems.map((g) => (
                  <div key={g.id} className="group overflow-hidden rounded-2xl bg-neutral-100">
                    <img
                      src={g.imageUrl}
                      alt={g.title ?? ""}
                      className="aspect-square w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-extrabold text-neutral-900">ساعات کاری</h2>
            <ul className="mt-4 space-y-2">
              {salon.openingHours.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm">
                  <span className="font-medium text-neutral-700">{days[h.dayOfWeek]}</span>
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
          />
        </aside>
      </div>
    </main>
  );
}
