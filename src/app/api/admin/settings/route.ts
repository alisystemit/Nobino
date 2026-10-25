

import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getAllSettings, updateSetting, invalidateSettings } from "@/lib/settings";
import { smsProviderMeta, resolveActiveSmsProviderId } from "@/lib/sms/providers";
import { json, apiError } from "@/lib/utils";

/** اگر فیلد secret همین مقدار را داشته باشد یعنی کاربر قصد تغییر ندارد */
export const KEEP_SECRET = "__KEEP__";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const settings = await getAllSettings();
    const activeSmsProvider = await resolveActiveSmsProviderId();

    return json({
      success: true,
      activeSmsProvider,
      smsProviders: smsProviderMeta,
      settings: settings.map((s) => ({
        key: s.key,
        group: s.group,
        type: s.type,
        options: s.options ? JSON.parse(s.options) : undefined,
        description: s.description,
        isSecret: s.isSecret,
        // برای secret مقدار واقعی ارسال نمی‌شود؛ فقط اینکه تنظیم شده یا نه
        hasValue: s.isSecret ? Boolean(s.value) : true,
        value: s.isSecret ? (s.value ? KEEP_SECRET : "") : s.value,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}

const updateSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string(),
      value: z.string().optional(),
      clear: z.boolean().optional(),
      group: z.string().optional(),
      type: z.string().optional(),
      isSecret: z.boolean().optional(),
    })
  ),
});

export async function PATCH(req: Request) {
  try {
    await requireRole(["ADMIN"]);
    const body = updateSchema.parse(await req.json());

    const existing = await getAllSettings();
    const existingMap = new Map(existing.map((s) => [s.key, s]));

    for (const u of body.updates) {
      const prev = existingMap.get(u.key);
      const isSecret = u.isSecret ?? prev?.isSecret ?? false;

      if (isSecret && u.value === KEEP_SECRET) {
        // تغییر نمی‌دهیم
        continue;
      }

      const value = u.clear ? null : u.value ?? "";
      await updateSetting(
        u.key,
        value ?? "",
        {
          group: u.group ?? prev?.group ?? "general",
          type: u.type ?? prev?.type ?? (isSecret ? "secret" : "string"),
          isSecret,
          description: prev?.description,
        }
      );
    }

    invalidateSettings();
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}

