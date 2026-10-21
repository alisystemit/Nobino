import { BaseGateway } from "@/lib/payments/gateways/base";
import { PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";
import { env, isSandbox } from "@/lib/env";

/**
 * درگاه آسان‌پرداخت (AsanPardakht)
 */
export class AsanPardakhtGateway extends BaseGateway {
  readonly id = "asanpardakht";
  readonly name = "آسان‌پرداخت";
  readonly sandbox = isSandbox(env.ASANPARDASHT_SANDBOX);

  private base = "https://ipg.asanpardakht.ir/api/v1";
  private gateway = "https://ipg.asanpardakht.ir/Pages/Public/Payment.aspx";

  async doRequestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    const invoiceNumber = Date.now().toString();
    const body = {
      merchantId: env.ASANPARDASHT_MERCHANT_ID,
      amount: order.amount * 10, // ریال
      callbackURL: order.callbackUrl,
      invoiceNumber,
      paymentId: order.id,
    };
    const res = await fetch(`${this.base}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.status === "SUCCESS" || data.token) {
      return {
        success: true,
        authority: data.token,
        redirectUrl: `${this.gateway}?Token=${data.token}`,
        referenceId: invoiceNumber,
      };
    }
    return { success: false, message: data.errorDescription ?? "خطای آسان‌پرداخت" };
  }

  async doVerifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.base}/Verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: env.ASANPARDASHT_MERCHANT_ID,
        amount: opts.order.amount * 10,
        invoiceNumber: opts.params.invoiceNumber ?? "",
      }),
    });
    const data = await res.json();
    if (data.status === "SUCCESS" || data.verifyResult === 0) {
      return { success: true, refId: data.verifyResult?.toString() ?? data.invoiceNumber, amount: opts.order.amount };
    }
    return { success: false, message: data.errorDescription ?? "تراکنش ناموفق" };
  }
}
