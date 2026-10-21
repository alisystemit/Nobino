import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { json, apiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const packages = await prisma.package.findMany({ orderBy: { price: "asc" } });
    return json({ success: true, packages });
  } catch (err) {
    return apiError(err);
  }
}

const patchSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  plan: z.string().optional(),
  price: z.number().int().min(0).optional(),
  yearlyPrice: z.number().int().min(0).nullable().optional(),
  durationDays: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireRole(["ADMIN"]);
    const body = patchSchema.parse(await req.json());

    const before = await prisma.package.findUnique({ where: { id: body.id } });
    if (!before) return json({ success: false, error: "پکیج یافت نشد" }, { status: 404 });

    const { id, ...data } = body;
    const updated = await prisma.package.update({ where: { id }, data });
    await logAudit({ actorId: user.id, actorPhone: user.phone, action: "update_package", entityType: "Package", entityId: id, before, after: updated });

    return json({ success: true, package: updated });
  } catch (err) {
    return apiError(err);
  }
}
