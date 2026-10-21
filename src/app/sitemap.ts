import { prisma } from "@/lib/prisma";
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/login", "/packages", "/wa"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // صفحات سالن‌ها (در صورت موجود بودن دیتابیس)
  let salonRoutes: MetadataRoute.Sitemap = [];
  try {
    const salons = await prisma.salon.findMany({ where: { isActive: true }, select: { slug: true } });
    salonRoutes = salons.flatMap((s): MetadataRoute.Sitemap => [
      { url: `${BASE}/s/${s.slug}`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
      { url: `${BASE}/wa/salon/${s.slug}`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ]);
  } catch {
    // بدون دیتابیس (در build) فقط مسیرهای ثابت
  }

  return [...staticRoutes, ...salonRoutes];
}
