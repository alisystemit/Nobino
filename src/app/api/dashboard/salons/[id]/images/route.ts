import { requireSalonManage } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { withinLimit } from "@/lib/plans/limits";
import { json, apiError } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"];

/**
 * بارگذاری تصویر سالن (لوگو، بنر یا گالری).
 * multipart/form-data: file + kind = logo | banner | gallery + title (اختیاری)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);

    const salon = await prisma.salon.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "gallery");
    const title = String(form.get("title") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return json({ success: false, error: "فایلی ارسال نشده است" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return json({ success: false, error: "فرمت تصویر مجاز نیست (JPG، PNG، WebP، GIF یا SVG)" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return json({ success: false, error: "حجم تصویر باید کمتر از ۵ مگابایت باشد" }, { status: 400 });
    }
    if (!["logo", "banner", "gallery"].includes(kind)) {
      return json({ success: false, error: "نوع تصویر نامعتبر است" }, { status: 400 });
    }

    if (kind === "gallery") {
      const galleryCount = await prisma.galleryItem.count({ where: { salonId: id } });
      // پلن رایگان حداکثر ۱۲ تصویر گالری؛ پلن‌های بالاتر ۱۰۰
      const limits = await import("@/lib/plans/limits").then((m) => m.getPlanLimits(id));
      const maxGallery = limits.api ? 200 : 12;
      if (galleryCount >= maxGallery) {
        return json(
          { success: false, error: `سقف تصاویر گالری پلن شما (${maxGallery} تصویر) پر شده است.` },
          { status: 403 }
        );
      }
      if (!(await withinLimit(id, "webapp"))) {
        return json({ success: false, error: "بارگذاری گالری در پلن فعلی فعال نیست" }, { status: 403 });
      }
    }

    const stored = await storeFile(file, { dir: "uploads" });

    if (kind === "logo" || kind === "banner") {
      await prisma.salon.update({
        where: { id },
        data: kind === "logo" ? { logoUrl: stored.url } : { bannerUrl: stored.url },
      });
      return json({ success: true, url: stored.url, kind });
    }

    const item = await prisma.galleryItem.create({
      data: { salonId: id, imageUrl: stored.url, title },
    });
    return json({ success: true, url: stored.url, kind, item }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

/** حذف تصویر گالری */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId");
    if (!itemId) return json({ success: false, error: "شناسه تصویر الزامی است" }, { status: 400 });

    const item = await prisma.galleryItem.findFirst({ where: { id: itemId, salonId: id } });
    if (!item) return json({ success: false, error: "تصویر یافت نشد" }, { status: 404 });

    await prisma.galleryItem.delete({ where: { id: item.id } });
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}

/** فهرست تصاویر گالری سالن */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const [items, salon] = await Promise.all([
      prisma.galleryItem.findMany({ where: { salonId: id }, orderBy: { sortOrder: "asc" } }),
      prisma.salon.findUnique({ where: { id }, select: { logoUrl: true, bannerUrl: true } }),
    ]);
    return json({ success: true, items, logoUrl: salon?.logoUrl ?? null, bannerUrl: salon?.bannerUrl ?? null });
  } catch (err) {
    return apiError(err);
  }
}
