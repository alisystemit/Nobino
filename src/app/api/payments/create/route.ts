import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { createPaymentForOrder } from "@/lib/payments/engine";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  packageId: z.string(),
  salonId: z.string().optional(),
  gateway: z.string().optional(),
  discountCode: z.string().optional(),
  period: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  autoRenew: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = schema.parse(await req.json());

    const pkg = await prisma.package.findUnique({ where: { id: body.packageId } });
    if (!pkg || !pkg.isActive) return json({ success: false, error: "پکیج یافت نشد" }, { status: 404 });

    // قیمت بر اساس دوره: سالانه = price*10 (یا yearlyPrice اگر تنظیم شده باشد)
    const unitPrice = body.period === "YEARLY" ? (pkg.yearlyPrice ?? pkg.price * 10) : pkg.price;

    let amount = unitPrice;
    let originalAmount = unitPrice;
    let discountId: string | undefined;

    // اعمال کد تخفیف
    if (body.discountCode) {
      const discount = await prisma.discount.findUnique({ where: { code: body.discountCode.trim().toUpperCase() } });
      if (!discount || !discount.isActive) {
        return json({ success: false, error: "کد تخفیف نامعتبر است" }, { status: 400 });
      }
      if (discount.expiresAt && discount.expiresAt < new Date()) {
        return json({ success: false, error: "کد تخفیف منقضی شده است" }, { status: 400 });
      }
      if (discount.maxUses > 0 && discount.usedCount >= discount.maxUses) {
        return json({ success: false, error: "کد تخفیف استفاده شده است" }, { status: 400 });
      }
      const discountAmount = Math.round((unitPrice * discount.percent) / 100);
      amount = Math.max(0, unitPrice - discountAmount);
      discountId = discount.id;
      originalAmount = pkg.price;
      // افزایش شمارنده استفاده در صورت پرداخت موفق بعداً انجام می‌شود
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        salonId: body.salonId,
        packageId: pkg.id,
        discountId,
        amount,
        originalAmount,
        period: body.period,
        autoRenew: body.autoRenew,
        status: "PENDING",
      },
    });

    const { payment, gateway } = await createPaymentForOrder({ orderId: order.id, gateway: body.gateway });

    return json(
      {
        success: true,
        orderId: order.id,
        paymentId: payment.id,
        gateway,
        redirectUrl: payment.redirectUrl,
        amount,
        originalAmount,
        discountApplied: discountId ? true : false,
      },
      { status: 201 }
    );
  } catch (err) {
    return apiError(err);
  }
}
