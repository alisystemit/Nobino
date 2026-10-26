

import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getPlanLimitsForPlan, normalizePlan } from "@/lib/plans/limits";
import { resolveFeatures } from "@/lib/plans/modules";
import { json, apiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const packages = await prisma.package.findMany({ orderBy: { price: "asc" } });
    const plans = [...new Set(packages.map((p) => normalizePlan(p.plan)))];
    const limitsByPlan = Object.fromEntries(
      await Promise.all(plans.map(async (plan) => [plan, await getPlanLimitsForPlan(plan)] as const))
    );
    return json({
      success: true,
      packages: packages.map((p) => {
        const plan = normalizePlan(p.plan);
        return {
          ...p,
          plan,
          featureLabels: resolveFeatures(p.features, limitsByPlan[plan]).map((f) => f.label),
        };
      }),
    });
  } catch (err) {
    return apiError(err);
  }
}

/** ماژول پکیج: یا کلید کاتالوگ (اختیاری: سقف عددی) یا متن دلخواه */
const featureSchema = z.union([
  z.string().min(1).max(120),
  z.object({
    key: z.string().min(1).max(60),
    value: z.number().int().min(0).max(100000).nullish(),
  }),
]);

const patchSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  plan: z.string().optional(),
  price: z.number().int().min(0).optional(),
  yearlyPrice: z.number().int().min(0).nullable().optional(),
  durationDays: z.number().int().positive().optional(),
  features: z.array(featureSchema).optional(),
  isActive: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  plan: z.string().default("BASIC"),
  price: z.number().int().min(0),
  yearlyPrice: z.number().int().min(0).nullable().optional(),
  durationDays: z.number().int().positive().default(30),
  features: z.array(featureSchema).default([]),
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

/** ساخت پکیج جدید توسط سوپرادمین */
export async function POST(req: Request) {
  try {
    const user = await requireRole(["ADMIN"]);
    const body = createSchema.parse(await req.json());
    const pkg = await prisma.package.create({ data: body });
    await logAudit({ actorId: user.id, actorPhone: user.phone, action: "create_package", entityType: "Package", entityId: pkg.id, after: body });
    return json({ success: true, package: pkg }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

/** حذف یا غیرفعال‌سازی پکیج؛ اگر اشتراک/سفارش داشته باشد فقط غیرفعال می‌شود */
export async function DELETE(req: Request) {
  try {
    const user = await requireRole(["ADMIN"]);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ success: false, error: "شناسه پکیج الزامی است" }, { status: 400 });

    const pkg = await prisma.package.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true, orders: true } } },
    });
    if (!pkg) return json({ success: false, error: "پکیج یافت نشد" }, { status: 404 });

    if (pkg._count.subscriptions > 0 || pkg._count.orders > 0) {
      const updated = await prisma.package.update({ where: { id }, data: { isActive: false } });
      await logAudit({
        actorId: user.id,
        actorPhone: user.phone,
        action: "deactivate_package",
        entityType: "Package",
        entityId: id,
        before: pkg,
        after: updated,
      });
      return json({ success: true, deactivated: true, package: updated });
    }

    await prisma.package.delete({ where: { id } });
    await logAudit({ actorId: user.id, actorPhone: user.phone, action: "delete_package", entityType: "Package", entityId: id, before: pkg });
    return json({ success: true, deleted: true });
  } catch (err) {
    return apiError(err);
  }
}

