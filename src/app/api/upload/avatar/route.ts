import { requireAuth } from "@/lib/auth/guards";
import { storeFile } from "@/lib/storage";
import { json, apiError } from "@/lib/utils";

export const instant = false;

const MAX_BYTES = 3 * 1024 * 1024; // ۳ مگابایت
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * بارگذاری تصویر پروفایل/آواتار (کاربر یا کارمند).
 * multipart/form-data: file
 * خروجی: { success, url }
 */
export async function POST(req: Request) {
  try {
    await requireAuth();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ success: false, error: "فایلی ارسال نشده است" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return json({ success: false, error: "فرمت تصویر مجاز نیست (JPG، PNG یا WebP)" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return json({ success: false, error: "حجم تصویر باید کمتر از ۳ مگابایت باشد" }, { status: 400 });
    }

    const stored = await storeFile(file, { dir: "uploads/avatars" });
    return json({ success: true, url: stored.url }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
